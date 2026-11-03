import {
  IsDateString,
  IsEnum,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
} from 'class-validator';
import { LeaveType } from '../../../generated/prisma/client.js';

export class CreateLeaveRequestDto {
  @IsUUID()
  studentId!: string;

  @Matches(/^(?!0000)\d{4}-\d{2}-\d{2}$/)
  @IsDateString({ strict: true })
  absenceDate!: string;

  @IsEnum(LeaveType)
  type!: LeaveType;

  @IsString()
  @Matches(/\S/u)
  @MaxLength(2000)
  reason!: string;
}
