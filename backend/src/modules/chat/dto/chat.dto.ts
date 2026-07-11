import { IsString, MinLength } from 'class-validator';

export class ChatDto {
  /** The user's natural-language question about their analytics. */
  @IsString()
  @MinLength(1)
  message!: string;
}
