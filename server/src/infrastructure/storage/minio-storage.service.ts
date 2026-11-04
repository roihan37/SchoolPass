import { randomUUID } from 'node:crypto';
import {
  CreateBucketCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadBucketCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { Inject, Injectable } from '@nestjs/common';
import { S3_CLIENT } from './storage.tokens.js';

const bucket = () => process.env.MINIO_BUCKET ?? 'schoolpass-private';

@Injectable()
export class MinioStorageService {
  constructor(@Inject(S3_CLIENT) private readonly client: S3Client) {}

  async put(file: { buffer: Buffer; mimeType: string }) {
    const objectKey = `attachments/${randomUUID()}`;
    await this.ensureBucket();
    await this.client.send(
      new PutObjectCommand({
        Bucket: bucket(),
        Key: objectKey,
        Body: file.buffer,
        ContentType: file.mimeType,
      }),
    );
    return objectKey;
  }

  async remove(objectKey: string) {
    await this.client.send(
      new DeleteObjectCommand({ Bucket: bucket(), Key: objectKey }),
    );
  }

  async signDownload(objectKey: string) {
    return getSignedUrl(
      this.client,
      new GetObjectCommand({
        Bucket: bucket(),
        Key: objectKey,
      }),
      { expiresIn: 300 },
    );
  }

  private async ensureBucket() {
    try {
      await this.client.send(new HeadBucketCommand({ Bucket: bucket() }));
    } catch (error) {
      const storageError = error as {
        name?: string;
        $metadata?: { httpStatusCode?: number };
      };
      if (
        storageError.name !== 'NotFound' &&
        storageError.name !== 'NoSuchBucket' &&
        storageError.$metadata?.httpStatusCode !== 404
      )
        throw error;
      try {
        await this.client.send(new CreateBucketCommand({ Bucket: bucket() }));
      } catch (error) {
        const name = (error as { name?: string }).name;
        if (
          name !== 'BucketAlreadyOwnedByYou' &&
          name !== 'BucketAlreadyExists'
        )
          throw error;
      }
    }
  }
}
