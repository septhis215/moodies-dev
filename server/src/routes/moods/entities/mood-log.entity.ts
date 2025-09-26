import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn } from 'typeorm';
import { Mood } from './mood.entity';

@Entity('mood_logs')
export class MoodLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  userId: string; // Reference to user (if you have user auth)

  @Column()
  moodId: string;

  @Column('int', { default: 5 })
  intensity: number; // 1-10 scale

  @Column('simple-array', { nullable: true })
  tags: string[];

  @Column('text', { nullable: true })
  context: string;

  @Column('json', { nullable: true })
  metadata: any; // Additional context data

  @ManyToOne(() => Mood, mood => mood.logs)
  @JoinColumn({ name: 'moodId' })
  mood: Mood;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  createdAt: Date;
}