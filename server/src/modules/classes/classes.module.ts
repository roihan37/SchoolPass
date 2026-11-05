import { Module } from '@nestjs/common';
import { PrismaModule } from '../../infrastructure/database/prisma.module.js';
import { ClassesController } from './classes.controller.js';
import { ClassesService } from './classes.service.js';

@Module({ imports: [PrismaModule], controllers: [ClassesController], providers: [ClassesService] })
export class ClassesModule {}
