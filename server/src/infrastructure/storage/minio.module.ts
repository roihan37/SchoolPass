import { Module } from '@nestjs/common';
import { S3Client } from '@aws-sdk/client-s3';
import { MinioStorageService } from './minio-storage.service.js';
import { S3_CLIENT } from './storage.tokens.js';

@Module({
  providers: [
    {
      provide: S3_CLIENT,
      useFactory: () =>
        new S3Client({
          endpoint: process.env.MINIO_ENDPOINT ?? 'http://127.0.0.1:9000',
          region: 'us-east-1',
          forcePathStyle: true,
          credentials: {
            accessKeyId: process.env.MINIO_ROOT_USER ?? '',
            secretAccessKey: process.env.MINIO_ROOT_PASSWORD ?? '',
          },
        }),
    },
    MinioStorageService,
  ],
  exports: [MinioStorageService],
})
export class MinioModule {}
