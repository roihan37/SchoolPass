import { Transform } from 'class-transformer';
import { IsEmail, IsIn, IsString, MaxLength, MinLength } from 'class-validator';

export class RegisterDto {
  @IsString()
  @Transform(({ value }) => typeof value === 'string' ? value.trim() : value)
  @MinLength(2)
  @MaxLength(100)
  name!: string;

  @IsEmail()
  @Transform(({ value }) => typeof value === 'string' ? value.trim().toLowerCase() : value)
  @MaxLength(254)
  email!: string;

  @IsString()
  @MinLength(8)
  @MaxLength(256)
  password!: string;

  @IsIn(['PARENT', 'TEACHER'])
  role!: 'PARENT' | 'TEACHER';
}
