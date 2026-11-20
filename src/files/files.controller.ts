import {
  Controller,
  Get,
  Post,
  Param,
  Delete,
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import { FilesService } from './files.service';
import { FileInterceptor } from '@nestjs/platform-express';
import { uuidPipe } from 'src/common/pipes/uuid.pipe';

@Controller('files')
export class FilesController {
  constructor(private readonly filesService: FilesService) {}

  @Post('upload')
  @UseInterceptors(FileInterceptor('file'))
  uploadFile(@UploadedFile() file: Express.Multer.File) {
    if (!file?.originalname) return { message: 'No file provided' };

    return this.filesService.uploadFile(file);
  }

  @Get(':id')
  findOne(@Param('id', uuidPipe) id: string) {
    return this.filesService.findOne(id);
  }

  @Delete(':id')
  remove(@Param('id', uuidPipe) id: string) {
    return this.filesService.remove(id);
  }
}
