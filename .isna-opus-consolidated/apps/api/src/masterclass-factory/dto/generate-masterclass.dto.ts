import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

export class GenerateMasterclassDto {
  @IsString()
  @MaxLength(100000)
  sourceText: string;

  @IsOptional()
  @IsString()
  lang?: string;

  @IsOptional()
  @IsIn(['liri-v1', 'failure-v2'])
  pedagogicalModel?: string;
}

export class AnalyzeDocumentDto {
  @IsString()
  @MaxLength(100000)
  sourceText: string;

  @IsOptional()
  @IsString()
  lang?: string;
}

export class EnqueueOrchestratorDto {
  @IsString()
  sourceText: string;

  @IsOptional()
  @IsIn(['liri-v1', 'failure-v2'])
  pedagogicalModel?: string;

  @IsOptional()
  @IsString()
  title?: string;
}

export class OrchestratorStatusDto {
  @IsString()
  jobId: string;
}
