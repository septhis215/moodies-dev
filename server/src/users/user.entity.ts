import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';
@Entity()
export class User {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ unique: true }) email: string;
  @Column() username: string;
  @Column({ nullable: true }) avatarUrl: string;
  @Column('text', { array: true, default: () => 'ARRAY[]::text[]' })
  preferredGenres: string[];
}
