import { Transform } from 'class-transformer';
import { IsString, MaxLength, MinLength } from 'class-validator';

export class EnrollStudentDto {
  @IsString()
  @MinLength(10)
  @MaxLength(128)
  classCode!: string;

  @Transform(({ value }) => typeof value === 'string' ? value.trim() : value)
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  studentName!: string;
}
