import { IsIn } from 'class-validator';

export const REACTION_TYPES = [
  'LIKE',
  'LOVE',
  'HAHA',
  'WOW',
  'SAD',
  'ANGRY',
] as const;

export type ReactionTypeDto = (typeof REACTION_TYPES)[number];

export class SetReactionDto {
  @IsIn(REACTION_TYPES)
  type!: ReactionTypeDto;
}
