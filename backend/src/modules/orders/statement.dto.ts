import { IsDateString, IsOptional } from 'class-validator';

export class StatementQueryDto {
  @IsOptional() @IsDateString({ strict: true }) fromDate?: string;
  @IsOptional() @IsDateString({ strict: true }) toDate?: string;
}
