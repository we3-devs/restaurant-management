import {
  Body,
  Controller,
  Get,
  Header,
  Param,
  Post,
  Query,
  Res,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { ExposeResponseFields } from '../../common/interceptors/expose-response-fields.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { User } from '../users/entities/user.entity';
import { ALLOWED_IMPORT_TYPES, MAX_IMPORT_UPLOAD_BYTES } from '../uploads/uploads.constants';
import { DataImportService } from './data-import.service';
import { ImporterRegistry } from './importer-registry';
import { CommitImportDto } from './dto/commit-import.dto';
import { RevalidateImportDto } from './dto/revalidate-import.dto';

/** Centralized authenticated bulk-import portal. */
@ApiTags('data-import')
@ApiBearerAuth()
@Controller('data-import')
export class DataImportController {
  constructor(
    private readonly dataImportService: DataImportService,
    private readonly registry: ImporterRegistry,
  ) {}

  @Get('domains')
  @ApiOperation({ summary: 'Lists domains available in the data-import portal' })
  listDomains() {
    return this.dataImportService.listDomains();
  }

  @Get('jobs')
  @ExposeResponseFields('createdAt', 'updatedAt')
  @ApiOperation({ summary: 'Paginated import job history, optionally filtered by domain/status' })
  listJobs(@Query('domain') domain?: string, @Query('status') status?: string) {
    return this.dataImportService.listJobs(domain, status);
  }

  @Get('jobs/:id')
  @ExposeResponseFields('createdAt', 'updatedAt')
  @ApiOperation({ summary: 'Detail for one import job (must belong to the requesting user)' })
  getJob(@Param('id') id: string, @Query('domain') domain: string, @CurrentUser() user: User) {
    return this.dataImportService.getJobDetail(domain, Number(id), user.id);
  }

  @Get(':domain/template')
  @Header('Content-Type', 'application/octet-stream')
  @ApiOperation({ summary: 'Downloads a blank import template for the domain' })
  async downloadTemplate(@Param('domain') domain: string, @Res() res: Response) {
    const config = this.registry.get(domain);
    const buffer = await config.buildTemplate();
    res.setHeader('Content-Disposition', `attachment; filename="${domain}-import-template.xlsx"`);
    res.send(buffer);
  }

  @Get(':domain/export')
  @Header('Content-Type', 'application/octet-stream')
  @ApiOperation({ summary: 'Downloads every existing record for the domain as a spreadsheet' })
  async export(@Param('domain') domain: string, @Res() res: Response) {
    const config = this.registry.get(domain);
    const buffer = await config.buildExport();
    res.setHeader('Content-Disposition', `attachment; filename="${domain}-export.xlsx"`);
    res.send(buffer);
  }

  @Post(':domain/preview')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: MAX_IMPORT_UPLOAD_BYTES },
      fileFilter: (_req, file, callback) => {
        callback(null, Object.prototype.hasOwnProperty.call(ALLOWED_IMPORT_TYPES, file.mimetype));
      },
    }),
  )
  @ApiConsumes('multipart/form-data')
  @ApiBody({ schema: { type: 'object', properties: { file: { type: 'string', format: 'binary' } } } })
  @ApiOperation({ summary: 'Parses and validates an uploaded CSV/Excel file for a domain, without saving anything' })
  async preview(
    @Param('domain') domain: string,
    @UploadedFile() file: Express.Multer.File | undefined,
    @CurrentUser() user: User,
  ) {
    return this.dataImportService.preview(domain, file, user.id);
  }

  @Post(':domain/revalidate')
  @ApiOperation({ summary: 'Re-runs domain validation against hand-edited preview rows' })
  revalidate(@Param('domain') domain: string, @Body() dto: RevalidateImportDto, @CurrentUser() user: User) {
    return this.dataImportService.revalidate(domain, dto, user.id);
  }

  @Post(':domain/commit')
  @ExposeResponseFields('createdAt', 'updatedAt')
  @ApiOperation({ summary: 'Re-validates and commits one chunk of previously previewed rows' })
  commit(@Param('domain') domain: string, @Body() dto: CommitImportDto, @CurrentUser() user: User) {
    return this.dataImportService.commit(domain, dto, user.id);
  }
}
