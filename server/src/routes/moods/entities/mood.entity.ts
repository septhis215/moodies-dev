import { Entity, PrimaryGeneratedColumn, Column, OneToMany } from 'typeorm';
import { MoodLog } from './mood-log.entity';

@Entity('moods')
export class Mood {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  name: string;

  @Column()
  color: string;

  @Column()
  icon: string;

  @Column('text')
  description: string;

  @Column('simple-array')
  keywords: string[]; // Keywords to match with TMDB genres

  @Column('simple-array')
  tmdbGenres: number[]; // TMDB genre IDs that match this mood

  @Column('decimal', { precision: 3, scale: 2, default: 0 })
  valence: number; // -1 to 1 (negative to positive)

  @Column('decimal', { precision: 3, scale: 2, default: 0 })
  arousal: number; // -1 to 1 (calm to excited)

  @Column({ default: true })
  isActive: boolean;

  @OneToMany(() => MoodLog, moodLog => moodLog.mood)
  logs: MoodLog[];

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  createdAt: Date;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  updatedAt: Date;
}