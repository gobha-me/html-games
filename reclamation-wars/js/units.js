// === UNIT MANAGEMENT ===
class Unit {
    constructor(type, owner, hex, id) {
        this.id = id;
        this.type = type;
        this.owner = owner;
        this.hex = hex; // Hex object
        const template = UNIT_TYPES[type];
        this.name = template.name;
        this.icon = template.icon;
        this.attack = template.attack;
        this.defense = template.defense;
        this.maxHp = template.hp;
        this.hp = template.hp;
        this.movement = template.movement + (owner === 'dust_runners' ? 1 : 0);
        this.movementLeft = this.movement;
        this.range = template.range || 1;
        this.hasAttacked = false;
        this.hasMoved = false;
    }

    canMoveTo(targetHex, gameMap) {
        if (this.hasMoved) return false;
        const distance = this.hex.distance(targetHex);
        return distance <= this.movementLeft && distance > 0;
    }

    canAttack(target, gameMap) {
        if (this.hasAttacked || this.attack === 0) return false;
        const distance = this.hex.distance(target.hex);
        return distance <= this.range;
    }

    move(targetHex) {
        this.hex = targetHex;
        this.movementLeft -= this.hex.distance(targetHex);
        this.hasMoved = true;
    }

    takeDamage(amount) {
        this.hp -= amount;
        return this.hp <= 0;
    }

    heal(amount) {
        this.hp = Math.min(this.maxHp, this.hp + amount);
    }

    resetTurn() {
        this.movementLeft = this.movement;
        this.hasAttacked = false;
        this.hasMoved = false;
    }

    getAttackBonus(faction) {
        let bonus = 0;
        if (faction.hasTech('advanced_metallurgy')) bonus += 1;
        return bonus;
    }

    getDefenseBonus(terrain, faction) {
        let bonus = terrain.defense;
        bonus += faction.getDefenseBonus(terrain.name);
        return bonus;
    }
}

class UnitManager {
    constructor(gameMap) {
        this.map = gameMap;
        this.units = [];
        this.nextId = 1;
    }

    createUnit(type, owner, hex) {
        const unit = new Unit(type, owner, hex, this.nextId++);
        this.units.push(unit);
        return unit;
    }

    getUnit(id) {
        return this.units.find(u => u.id === id);
    }

    getUnitsByOwner(owner) {
        return this.units.filter(u => u.owner === owner);
    }

    getUnitsOnHex(hex) {
        return this.units.filter(u => u.hex.equals(hex));
    }

    getEnemyUnitsOnHex(hex, owner) {
        return this.units.filter(u => u.hex.equals(hex) && u.owner !== owner);
    }

    getUnitsInRange(hex, range, owner) {
        return this.units.filter(u => {
            if (owner && u.owner !== owner) return false;
            return u.hex.distance(hex) <= range;
        });
    }

    removeUnit(unit) {
        const idx = this.units.indexOf(unit);
        if (idx >= 0) {
            this.units.splice(idx, 1);
        }
    }

    removeDeadUnits() {
        this.units = this.units.filter(u => u.hp > 0);
    }

    resetTurnForFaction(owner) {
        for (const unit of this.units) {
            if (unit.owner === owner) {
                unit.resetTurn();
            }
        }
    }

    healAllForFaction(owner, amount) {
        for (const unit of this.units) {
            if (unit.owner === owner) {
                unit.heal(amount);
            }
        }
    }

    // Combat resolution
    resolveCombat(attacker, defender, gameRef) {
        const attackerFaction = gameRef.factions.find(f => f.id === attacker.owner);
        const defenderFaction = gameRef.factions.find(f => f.id === defender.owner);
        const terrain = this.map.getTerrain(defender.hex);
        const attackPower = attacker.attack + attacker.getAttackBonus(attackerFaction);
        const defensePower = defender.getDefenseBonus(terrain, defenderFaction) + defender.defense;

        // Combat formula with some randomness
        const attackRoll = attackPower * (0.8 + Math.random() * 0.4);
        const defenseRoll = defensePower * (0.8 + Math.random() * 0.4);

        const damage = Math.max(1, Math.floor(attackRoll - defenseRoll * 0.5));
        const killed = defender.takeDamage(damage);

        // Counter-attack if defender survives and is in melee range
        let counterDamage = 0;
        if (!killed && attacker.hex.distance(defender.hex) === 1) {
            const counterAttack = Math.max(0, defender.attack - attacker.defense * 0.5);
            counterDamage = Math.floor(counterAttack * (0.5 + Math.random() * 0.5));
            if (counterDamage > 0) {
                attacker.takeDamage(counterDamage);
            }
        }

        attacker.hasAttacked = true;

        return {
            damage,
            counterDamage,
            defenderKilled: killed,
            attackerKilled: attacker.hp <= 0,
            attackPower: Math.floor(attackRoll),
            defensePower: Math.floor(defenseRoll)
        };
    }

    // Get units that can reach a hex
    getUnitsThatCanReach(hex, owner) {
        return this.units.filter(u => {
            if (u.owner !== owner || u.hasMoved) return false;
            return u.canMoveTo(hex, this.map);
        });
    }
    // Get targets a unit can attack
    getAttackTargets(unit) {
        if (unit.hasAttacked || unit.attack === 0) return [];

        return this.units.filter(target => {
            if (target.owner === unit.owner) return false;
            const distance = unit.hex.distance(target.hex);
            return distance <= unit.range;
        });
    }
}
