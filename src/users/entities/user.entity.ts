import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
  UpdateDateColumn,
  BeforeInsert,
  BeforeUpdate,
} from 'typeorm';
import { Rol } from 'src/rols/entities/rol.entity';
import { File } from 'src/files/entities/file.entity';

@Entity()
export class User {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'text', nullable: true })
  name?: string | null;

  @Column({ type: 'text', nullable: true })
  lastName?: string | null;

  @Column({ type: 'text', nullable: true })
  secondLastName?: string | null;

  @Column({ type: 'text', nullable: false, unique: true })
  email!: string;

  // @Column({ type: 'text', nullable: true })
  // phone?: string | null;

  @Column({ type: 'text', nullable: true })
  password?: string | null;

  @Column({ type: 'boolean', nullable: true, default: true })
  status?: boolean | null;

  // @Column({ type: 'varchar', nullable: true })
  // folio?: string | null;

  // @Column({ type: 'text', nullable: true })
  // position?: string | null;

  @Column({ type: 'timestamp', nullable: true })
  lastLoginAt?: Date | null;

  @ManyToOne(() => Rol, (rol) => rol.users, { nullable: true, eager: true })
  rol?: Rol | null;

  @ManyToOne(() => File, (file) => file.users, { nullable: true, eager: true })
  avatar?: File | null;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updateAt!: Date;

  @BeforeInsert()
  @BeforeUpdate()
  updateData() {
    if (this.email) this.email = this.email.toLowerCase().trim();

    if (this.name != null) this.name = this.normalizeName(this.name);
    if (this.lastName != null)
      this.lastName = this.normalizeName(this.lastName);
    if (this.secondLastName != null)
      this.secondLastName = this.normalizeName(this.secondLastName);
  }

  normalizeName(name: string | null | undefined): string | null | undefined {
    if (name == null) return name;
    return name
      .trim()
      .replace(/\s+/g, ' ') // Reemplaza múltiples espacios por uno solo
      .split(' ')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
  }
}
