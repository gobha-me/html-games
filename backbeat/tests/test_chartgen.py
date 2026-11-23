"""Dependency-free tests; audio decoding is a mocked subprocess port."""
import contextlib
import importlib.util
import io
import json
import os
from pathlib import Path
import struct
import subprocess
import sys
import tempfile
import unittest
from unittest.mock import patch


SPEC = importlib.util.spec_from_file_location(
    "backbeat_chartgen", Path(__file__).resolve().parents[1] / "tools" / "chartgen.py"
)
chartgen = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(chartgen)


class PCMTests(unittest.TestCase):
    def test_pcm_decode_uses_argument_vector_and_preserves_signed_little_endian_samples(self):
        path = "path with spaces ; literal.wav"
        raw = struct.pack("<4h", -32768, -1, 0, 32767)
        with patch.object(chartgen.subprocess, "run", return_value=subprocess.CompletedProcess([], 0, raw)) as run:
            samples, rate = chartgen.read_pcm_mono(path, rate=8000)
        self.assertEqual(list(samples), [-32768, -1, 0, 32767])
        self.assertEqual(rate, 8000)
        run.assert_called_once_with(
            ["ffmpeg", "-v", "error", "-i", path, "-ac", "1", "-ar", "8000", "-f", "s16le", "-"],
            capture_output=True, check=True,
        )

    def test_pcm_empty_output_and_decoder_failure(self):
        with patch.object(chartgen.subprocess, "run", return_value=subprocess.CompletedProcess([], 0, b"")):
            self.assertEqual(list(chartgen.read_pcm_mono("empty.wav")[0]), [])
        error = subprocess.CalledProcessError(1, ["ffmpeg"])
        with patch.object(chartgen.subprocess, "run", side_effect=error):
            with self.assertRaises(subprocess.CalledProcessError):
                chartgen.read_pcm_mono("bad.wav")


class AnalysisTests(unittest.TestCase):
    def test_envelope_measures_only_positive_energy_changes_and_sample_clock(self):
        # End with a partial window, so this passing case does not pin the
        # separately recorded bug that skips the final complete window.
        samples = [1, 1, 3, 3, 2, 2, 4, 4, 0]
        original = samples[:]
        times, strengths = chartgen.onset_envelope(samples, 10, hop=2, win=2)
        self.assertEqual(times, [0, 0.2, 0.4, 0.6])
        self.assertEqual(strengths, [1, 8, 0, 12])
        self.assertEqual(samples, original)

    def test_empty_or_short_envelope_has_no_complete_analysis_windows(self):
        self.assertEqual(chartgen.onset_envelope([], 22050), ([], []))
        self.assertEqual(chartgen.onset_envelope([1] * 100, 22050), ([], []))

    def test_onsets_include_threshold_and_gap_boundaries_then_round_to_milliseconds(self):
        times = [0, 0.1, 0.2, 0.4, 0.60049]
        strengths = [10, 10, 2.9, 3, 4]
        self.assertEqual(chartgen.detect_onsets(times, strengths, min_gap=0.2), [0, 0.4, 0.6])
        self.assertEqual(chartgen.detect_onsets([], []), [])
        self.assertEqual(chartgen.detect_onsets([0, 0.2], [2.99, 10]), [0.2])

    def test_bpm_requires_three_onsets_and_excludes_extreme_intervals(self):
        for onsets in [[], [0], [0, 0.5], [0, 0.125, 2.125, 4.125]]:
            self.assertIsNone(chartgen.estimate_bpm(onsets))
        self.assertEqual(chartgen.estimate_bpm([0, 0.5, 1, 1.5]), 120)
        self.assertEqual(chartgen.estimate_bpm([0, 0.5, 1, 1.5, 3.0]), 120)

    def test_bpm_octave_normalization_and_decimal_rounding(self):
        self.assertEqual(chartgen.estimate_bpm([0, 1, 2]), 120)
        self.assertEqual(chartgen.estimate_bpm([0, 0.25, 0.5]), 120)
        self.assertEqual(chartgen.estimate_bpm([0, 0.7, 1.4]), 85.7)


class ChartTests(unittest.TestCase):
    def test_default_chart_preserves_metadata_and_uses_all_four_lanes(self):
        onsets = [0, 0.5, 1, 1.5, 2, 2.5]
        chart = chartgen.generate_chart(onsets, 120, "track.ogg", "Title")
        self.assertEqual([n["time"] for n in chart["notes"]], onsets)
        self.assertEqual([n["lane"] for n in chart["notes"]], [3, 0, 1, 0, 1, 2])
        self.assertEqual(chart["title"], "Title")
        self.assertEqual(chart["audio"], "track.ogg")
        self.assertEqual(chart["bpm"], 120)
        self.assertEqual(chart["offset"], 0)
        self.assertEqual(onsets, [0, 0.5, 1, 1.5, 2, 2.5])
        self.assertEqual(chart, chartgen.generate_chart(onsets, 120, "track.ogg", "Title"))

    def test_density_thins_at_supported_intervals_and_clamps_extreme_inputs(self):
        onsets = list(range(12))
        def times(density):
            return [n["time"] for n in chartgen.generate_chart(onsets, 120, "x", "X", density)["notes"]]
        self.assertEqual(times(0.5), [0, 2, 4, 6, 8, 10])
        self.assertEqual(times(0.25), [0, 4, 8])
        self.assertEqual(times(0), [0, 4, 8])
        self.assertEqual(times(-10), [0, 4, 8])
        self.assertEqual(times(2), onsets)
        self.assertEqual(times(100), onsets)
        self.assertEqual(chartgen.generate_chart([], 120, "x", "X")["notes"], [])


class CLITests(unittest.TestCase):
    def run_main(self, args, onsets=(0, 0.5, 1)):
        stdout = io.StringIO()
        with patch.object(sys, "argv", ["chartgen.py", *args]), \
             patch.object(chartgen, "read_pcm_mono", return_value=([1], 22050)) as decoder, \
             patch.object(chartgen, "onset_envelope", return_value=([0], [1])), \
             patch.object(chartgen, "detect_onsets", return_value=list(onsets)), \
             contextlib.redirect_stdout(stdout):
            chartgen.main()
        return stdout.getvalue(), decoder

    def test_analyze_outputs_machine_readable_summary_and_first_twelve_onsets(self):
        output, decoder = self.run_main(["analyze", "analysis.wav"], tuple(i * 0.5 for i in range(15)))
        decoder.assert_called_once_with("analysis.wav")
        summary = json.loads(output)
        self.assertEqual(summary["bpm"], 120)
        self.assertEqual(summary["onsets"], 15)
        self.assertEqual(summary["first_onsets"], [i * 0.5 for i in range(12)])

    def test_generate_writes_json_with_explicit_bpm_audio_title_and_density(self):
        with tempfile.TemporaryDirectory() as directory:
            output_path = Path(directory) / "chart.json"
            output, decoder = self.run_main([
                "generate", "analysis.wav", "--audio", "game.ogg", "--title", "A title",
                "--out", str(output_path), "--bpm", "150", "--density", "0.5",
            ])
            chart = json.loads(output_path.read_text())
        decoder.assert_called_once_with("analysis.wav")
        self.assertEqual(chart["bpm"], 150)
        self.assertEqual(chart["audio"], "game.ogg")
        self.assertEqual(chart["title"], "A title")
        self.assertEqual([n["time"] for n in chart["notes"]], [0, 1])
        self.assertIn("2 notes @ 150.0 BPM", output)

    def test_generate_prefers_detected_bpm_and_falls_back_to_120(self):
        with tempfile.TemporaryDirectory() as directory:
            output_path = Path(directory) / "chart.json"
            args = ["generate", "input.wav", "--audio", "x.ogg", "--title", "X", "--out", str(output_path)]
            self.run_main(args, (0, 0.4, 0.8))
            self.assertEqual(json.loads(output_path.read_text())["bpm"], 150)
            self.run_main(args, ())
            self.assertEqual(json.loads(output_path.read_text())["bpm"], 120)


class KnownDefectTests(unittest.TestCase):
    @unittest.skipUnless(os.environ.get("BACKBEAT_RUN_KNOWN_BUGS") == "1", "Finding: all-zero energy is treated as detected onsets")
    def test_silence_should_not_generate_onsets(self):
        self.assertEqual(chartgen.detect_onsets([0, 0.2, 0.4], [0, 0, 0]), [])

    @unittest.skipUnless(os.environ.get("BACKBEAT_RUN_KNOWN_BUGS") == "1", "Finding: onset_envelope excludes the final complete window")
    def test_exactly_one_complete_window_should_be_analyzed(self):
        self.assertEqual(chartgen.onset_envelope([2, 2], 10, hop=2, win=2), ([0], [4]))


if __name__ == "__main__":
    unittest.main()
