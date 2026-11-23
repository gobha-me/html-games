import json
from pathlib import Path
# Specification: https://tetris.wiki/Super_Rotation_System#Wall_Kicks
# Run from any directory; this regenerates srs-cavities.mjs deterministically.
# Published SRS table in the source's positive-y-up convention. This generator
# never loads production scripts or their kick tables.
j={
(0,1):[(0,0),(-1,0),(-1,1),(0,-2),(-1,-2)],
(1,0):[(0,0),(1,0),(1,-1),(0,2),(1,2)],
(1,2):[(0,0),(1,0),(1,-1),(0,2),(1,2)],
(2,1):[(0,0),(-1,0),(-1,1),(0,-2),(-1,-2)],
(2,3):[(0,0),(1,0),(1,1),(0,-2),(1,-2)],
(3,2):[(0,0),(-1,0),(-1,-1),(0,2),(-1,2)],
(3,0):[(0,0),(-1,0),(-1,-1),(0,2),(-1,2)],
(0,3):[(0,0),(1,0),(1,1),(0,-2),(1,-2)],
}
i={
(0,1):[(0,0),(-2,0),(1,0),(-2,-1),(1,2)],
(1,0):[(0,0),(2,0),(-1,0),(2,1),(-1,-2)],
(1,2):[(0,0),(-1,0),(2,0),(-1,2),(2,-1)],
(2,1):[(0,0),(1,0),(-2,0),(1,-2),(-2,1)],
(2,3):[(0,0),(2,0),(-1,0),(2,1),(-1,-2)],
(3,2):[(0,0),(-2,0),(1,0),(-2,-1),(1,2)],
(3,0):[(0,0),(1,0),(-2,0),(1,-2),(-2,1)],
(0,3):[(0,0),(-1,0),(2,0),(-1,2),(2,-1)],
}
spawns={'T':['.#.','###','...'],'J':['#..','###','...'],'L':['..#','###','...'],'S':['.##','##.','...'],'Z':['##.','.##','...'],'I':['....','####','....','....']}

def cells(kind,rotation,x,y):
    p=[(xx,yy) for yy,row in enumerate(spawns[kind]) for xx,c in enumerate(row) if c=='#']
    size=len(spawns[kind])
    for _ in range(rotation): p=[(size-1-yy,xx) for xx,yy in p]
    return {(x+xx,y+yy) for xx,yy in p}
def inbounds(p): return all(0<=x<10 and y<20 for x,y in p)
fixtures=[]; missing=[]
for kind in spawns:
    table=i if kind=='I' else j
    for (rotation,nextrot),kicks in table.items():
        direction=1 if (rotation+1)%4==nextrot else -1
        for selected in range(5):
            result=None
            for y in [8,0,17,18,19,-1,-2,1,2,3,4,5,6,7,9,10,11,12,13,14,15,16]:
                for x in [3,0,7,8,-1,-2,1,2,4,5,6,9]:
                    start=cells(kind,rotation,x,y)
                    dx,dy=kicks[selected]
                    target=cells(kind,nextrot,x+dx,y-dy)
                    if not inbounds(start) or not inbounds(target): continue
                    protected=start|target
                    blockers=set()
                    for earlier,(ex,ey) in enumerate(kicks[:selected]):
                        candidate=cells(kind,nextrot,x+ex,y-ey)
                        if not inbounds(candidate) or candidate&blockers: continue
                        choices=sorted(p for p in candidate-protected if p[1]>=0)
                        if not choices: break
                        blockers.add(choices[0])
                    else:
                        result={'type':kind,'from':rotation,'direction':direction,'kick':selected+1,'at':[x,y],'blocks':sorted(blockers),'to':[x+dx,y-dy,nextrot]}
                        break
                if result: break
            if result: fixtures.append(result)
            else: missing.append([kind,rotation,nextrot,selected+1])
out=Path(__file__).with_name('srs-cavities.mjs')
out.write_text('export default [\n'+',\n'.join('  '+json.dumps(f,separators=(',',':')) for f in fixtures)+'\n];\n')
print('fixtures',len(fixtures),'bytes',out.stat().st_size,'not independently selectable',missing)
