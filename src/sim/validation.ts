import { UNITS } from './content';
export interface TriggerValidationOptions {
    teamCount?: number;
    width?: number;
    height?: number;
}
const record = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === 'object' && !Array.isArray(value);
const finite = (value: unknown, minimum = 0, maximum = Infinity): value is number => typeof value === 'number' && Number.isFinite(value) && value >= minimum && value <= maximum;
const nonempty = (value: unknown): value is string => typeof value === 'string' && value.trim().length > 0;
/** Validate declarative campaign data before accepting content or resuming a save. */
export function validateTriggers(input: unknown, options: TriggerValidationOptions = {}): string[] {
    if (!Array.isArray(input))
        return ['Mission triggers must be an array.'];
    const errors: string[] = [], ids = new Set<string>();
    const teamCount = options.teamCount ?? 6;
    const team = (value: unknown) => Number.isInteger(value) && finite(value, 0, teamCount - 1);
    const point = (value: Record<string, unknown>) => finite(value.x) && finite(value.y)
        && (options.width === undefined || value.x < options.width)
        && (options.height === undefined || value.y < options.height);
    input.forEach((trigger, index) => {
        const label = record(trigger) && nonempty(trigger.id) ? trigger.id : `trigger ${index + 1}`;
        if (!record(trigger)) {
            errors.push(`${label}: expected a trigger object.`);
            return;
        }
        if (!nonempty(trigger.id) || ids.has(trigger.id))
            errors.push(`${label}: missing or duplicate trigger ID.`);
        else
            ids.add(trigger.id);
        if (trigger.fired !== undefined && typeof trigger.fired !== 'boolean')
            errors.push(`${label}: fired must be a boolean.`);
        const when = trigger.when;
        if (!record(when))
            errors.push(`${label}: missing trigger condition.`);
        else {
            let valid = false;
            switch (when.type) {
                case 'time':
                    valid = finite(when.seconds);
                    break;
                case 'captured':
                    valid = team(when.team) && nonempty(when.nodeId);
                    break;
                case 'resource':
                    valid = team(when.team) && typeof when.resource === 'string' && ['gold', 'wood'].includes(when.resource) && finite(when.amount);
                    break;
                case 'destroyed':
                    valid = nonempty(when.entityId);
                    break;
                case 'region':
                    valid = team(when.team) && point(when) && finite(when.radius, .001);
                    break;
            }
            if (!valid)
                errors.push(`${label}: unknown or invalid trigger condition.`);
        }
        if (!Array.isArray(trigger.actions) || trigger.actions.length === 0) {
            errors.push(`${label}: at least one action is required.`);
            return;
        }
        trigger.actions.forEach((action, actionIndex) => {
            let valid = false;
            if (record(action))
                switch (action.type) {
                    case 'dialogue':
                        valid = nonempty(action.text) && (action.team === undefined || team(action.team));
                        break;
                    case 'resources':
                        valid = team(action.team) && finite(action.gold) && finite(action.wood);
                        break;
                    case 'spawn':
                        valid = team(action.team) && typeof action.unit === 'string'
                            && Object.prototype.hasOwnProperty.call(UNITS, action.unit)
                            && Number.isInteger(action.count) && finite(action.count, 1, 1000) && point(action);
                        break;
                    case 'victory':
                    case 'reveal':
                        valid = team(action.team);
                        break;
                    case 'objective':
                        valid = nonempty(action.text);
                        break;
                }
            if (!valid)
                errors.push(`${label}: action ${actionIndex + 1} has invalid data, content IDs, or team.`);
        });
    });
    return errors;
}
