import { IsIn, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class ProcessEnrollmentDto {
  @IsIn(['approved', 'rejected'])
  action: 'approved' | 'rejected';

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;
}

export class AssignTeacherDto {
  @IsUUID()
  teacherId: string;

  @IsUUID()
  studentId: string;

  @IsOptional()
  @IsString()
  courseId?: string;
}

export class CreateDocumentDto {
  @IsString()
  @MaxLength(500)
  title: string;

  @IsString()
  type: string;

  @IsOptional()
  @IsString()
  content?: string;
}

export class UpdateWorkflowStepDto {
  @IsIn(['pending', 'in_progress', 'completed', 'blocked'])
  status: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
