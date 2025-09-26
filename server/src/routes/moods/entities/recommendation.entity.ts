import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity('recommendations')
export class Recommendation {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  userId: string;

  @Column()
  moodId: string;

  @Column('int')
  tmdbId: number;

  @Column()
  mediaType: 'movie' | 'tv';

  @Column()
  title: string;

  @Column('text', { nullable: true })
  overview: string;

  @Column('simple-array')
  genreIds: number[];

  @Column('decimal', { precision: 3, scale: 2 })
  voteAverage: number;

  @Column('int')
  voteCount: number;

  @Column({ nullable: true })
  releaseDate: string;

  @Column({ nullable: true })
  posterPath: string;

  @Column({ nullable: true })
  backdropPath: string;

  @Column('decimal', { precision: 4, scale: 3 })
  score: number; // Recommendation confidence score

  @Column('text')
  reason: string;

  @Column()
  algorithm: string;

  @Column('json', { nullable: true })
  metadata: any;

  @Column({ default: false })
  viewed: boolean;

  @Column({ default: false })
  liked: boolean;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  createdAt: Date;
}