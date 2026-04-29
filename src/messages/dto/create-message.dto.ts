import { IsString, IsNotEmpty, MaxLength } from 'class-validator';

export class CreateMessageDto {
  @IsString()
  @IsNotEmpty({ message: 'Message content cannot be empty' })
  @MaxLength(1000, {
    message: 'Message content must not exceed 1000 characters',
  })
  content: string = '';
}