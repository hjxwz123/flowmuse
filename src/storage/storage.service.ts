import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import COS from 'cos-nodejs-sdk-v5';
import axios from 'axios';
import { lookup as mimeLookup, extension as mimeExtension } from 'mime-types';
import { createHash } from 'node:crypto';
import { createWriteStream } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, extname, join } from 'node:path';
import { pipeline } from 'node:stream/promises';
import sharp from 'sharp';

type StorageDriver = 'cos' | 'local';
export type VideoInputUploadKind = 'image' | 'video' | 'audio';
export type ProjectAssetUploadKind = 'image' | 'video';

export type StoredObject = {
  ossKey: string;
  url: string;
  contentType?: string;
  size?: number;
};

export type StoredImageResult = {
  original: StoredObject;
  thumbnail: StoredObject;
};

export type StoredProjectAssetResult = {
  original: StoredObject;
  thumbnail: StoredObject | null;
};

type CosProcessQueryValue = string | number;

type CosAvinfoResponse = {
  format?: {
    duration?: string | number | null;
  } | null;
  video?: {
    duration?: string | number | null;
  } | null;
  streams?: Array<{
    codec_type?: string | null;
    duration?: string | number | null;
  }> | null;
};

function stripTrailingSlash(url: string) {
  return url.replace(/\/+$/, '');
}

function isHttpUrl(value: string) {
  try {
    const u = new URL(value);
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
}

function parseDataUrl(value: string): { contentType: string; base64: string } | null {
  const m = value.match(/^data:([^;]+);base64,(.*)$/);
  if (!m) return null;
  return { contentType: m[1], base64: m[2] };
}

function normalizeBase64(value: string) {
  return value.replace(/\s+/g, '');
}

function sha1Hex(input: Buffer) {
  return createHash('sha1').update(input).digest('hex');
}

function getVideoInputFolder(kind: VideoInputUploadKind) {
  if (kind === 'image') return 'video-inputs/images';
  if (kind === 'video') return 'video-inputs/videos';
  return 'video-inputs/audios';
}

@Injectable()
export class StorageService {
  private readonly driver: StorageDriver;

  private readonly cos: COS | null;
  private readonly cosBucket: string | null;
  private readonly cosRegion: string | null;
  private readonly cosPublicBaseUrl: string | null;
  private readonly cosAcl: string | null;

  constructor(private readonly config: ConfigService) {
    this.driver = (this.config.get<string>('STORAGE_DRIVER') as StorageDriver) ?? 'cos';

    if (this.driver === 'cos') {
      const secretId = this.config.get<string>('COS_SECRET_ID') ?? '';
      const secretKey = this.config.get<string>('COS_SECRET_KEY') ?? '';
      const bucket = this.config.get<string>('COS_BUCKET') ?? '';
      const region = this.config.get<string>('COS_REGION') ?? '';
      if (!secretId || !secretKey || !bucket || !region) {
        throw new Error('Missing COS config: COS_SECRET_ID/COS_SECRET_KEY/COS_BUCKET/COS_REGION');
      }

      this.cos = new COS({ SecretId: secretId, SecretKey: secretKey });
      this.cosBucket = bucket;
      this.cosRegion = region;
      this.cosPublicBaseUrl = (this.config.get<string>('COS_PUBLIC_BASE_URL') ?? '').trim() || null;
      this.cosAcl = (this.config.get<string>('COS_ACL') ?? '').trim() || null;
      return;
    }

    this.cos = null;
    this.cosBucket = null;
    this.cosRegion = null;
    this.cosPublicBaseUrl = null;
    this.cosAcl = null;
  }

  private localUploadRoot() {
    return join(process.cwd(), 'uploads');
  }

  private localPublicBaseUrl() {
    const base = (this.config.get<string>('APP_PUBLIC_URL') ?? '').trim();
    return base ? stripTrailingSlash(base) : '';
  }

  private toObjectUrl(key: string) {
    if (this.driver === 'cos') {
      if (!this.cosBucket || !this.cosRegion) throw new Error('COS not configured');
      if (this.cosPublicBaseUrl) return `${stripTrailingSlash(this.cosPublicBaseUrl)}/${key}`;
      return `https://${this.cosBucket}.cos.${this.cosRegion}.myqcloud.com/${key}`;
    }

    const base = this.localPublicBaseUrl();
    const path = `/uploads/${key}`;
    return base ? `${base}${path}` : path;
  }

  private async cosPutObject(key: string, body: Buffer, contentType?: string) {
    if (!this.cos || !this.cosBucket || !this.cosRegion) throw new Error('COS not configured');

    const params: COS.PutObjectParams = {
      Bucket: this.cosBucket,
      Region: this.cosRegion,
      Key: key,
      Body: body,
    };
    if (contentType) params.ContentType = contentType;
    if (this.cosAcl) params.ACL = this.cosAcl as COS.ObjectACL;

    // Add timeout wrapper to prevent hanging uploads
    const uploadPromise = new Promise<void>((resolve, reject) => {
      this.cos!.putObject(params, (err: any) => {
        if (err) reject(err);
        else resolve();
      });
    });

    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error(`COS upload timeout after 120 seconds (key: ${key}, size: ${body.length} bytes)`)), 120_000);
    });

    await Promise.race([uploadPromise, timeoutPromise]);
  }

  private async cosPutObjectStream(
    key: string,
    body: NodeJS.ReadableStream,
    contentType?: string,
    contentLength?: number,
  ) {
    if (!this.cos || !this.cosBucket || !this.cosRegion) throw new Error('COS not configured');

    const params: COS.PutObjectParams = {
      Bucket: this.cosBucket,
      Region: this.cosRegion,
      Key: key,
      Body: body as any,
    };
    if (contentType) params.ContentType = contentType;
    if (contentLength) params.ContentLength = contentLength;
    if (this.cosAcl) params.ACL = this.cosAcl as COS.ObjectACL;

    // Add timeout wrapper to prevent hanging uploads (longer timeout for streams/videos)
    const uploadPromise = new Promise<void>((resolve, reject) => {
      this.cos!.putObject(params, (err: any) => {
        if (err) reject(err);
        else resolve();
      });
    });

    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error(`COS stream upload timeout after 180 seconds (key: ${key})`)), 180_000);
    });

    await Promise.race([uploadPromise, timeoutPromise]);
  }

  private async localWriteFile(key: string, body: Buffer) {
    const destPath = join(this.localUploadRoot(), key);
    await mkdir(dirname(destPath), { recursive: true });
    await writeFile(destPath, body);
    return destPath;
  }

  private async localWriteStream(key: string, stream: NodeJS.ReadableStream) {
    const destPath = join(this.localUploadRoot(), key);
    await mkdir(dirname(destPath), { recursive: true });
    await pipeline(stream, createWriteStream(destPath));
    return destPath;
  }

  private inferExtFromContentType(contentType: string | undefined) {
    if (!contentType) return '';
    const clean = contentType.split(';')[0]?.trim();
    if (!clean) return '';
    const ext = mimeExtension(clean);
    return ext ? `.${ext}` : '';
  }

  private inferExtFromUrl(url: string) {
    try {
      const u = new URL(url);
      const e = extname(u.pathname);
      if (e && e.length <= 10) return e;
      return '';
    } catch {
      return '';
    }
  }

  private inferContentTypeFromKey(key: string) {
    return (mimeLookup(key) || undefined) as string | undefined;
  }

  private async fetchUrlToBuffer(url: string, timeoutMs = 300_000) {
    const res = await axios.get<ArrayBuffer>(url, { responseType: 'arraybuffer', timeout: timeoutMs });
    const contentType = (res.headers['content-type'] as string | undefined) ?? undefined;
    const buffer = Buffer.from(res.data);
    return { buffer, contentType };
  }

  private async fetchUrlToJson<T>(url: string, timeoutMs = 300_000) {
    const res = await axios.get<T>(url, { responseType: 'json', timeout: timeoutMs });
    return res.data;
  }

  private async fetchUrlToStream(url: string, timeoutMs = 300_000) {
    const res = await axios.get(url, { responseType: 'stream', timeout: timeoutMs });
    const contentType = (res.headers['content-type'] as string | undefined) ?? undefined;
    const contentLengthHeader = (res.headers['content-length'] as string | undefined) ?? undefined;
    const contentLength = contentLengthHeader ? Number(contentLengthHeader) : undefined;
    return { stream: res.data as NodeJS.ReadableStream, contentType, contentLength };
  }

  private decodeBase64ToBuffer(value: string) {
    const parsed = parseDataUrl(value);
    if (parsed) {
      const buffer = Buffer.from(normalizeBase64(parsed.base64), 'base64');
      return { buffer, contentType: parsed.contentType };
    }

    const buffer = Buffer.from(normalizeBase64(value), 'base64');
    return { buffer, contentType: undefined };
  }

  private async putObject(folder: string, baseName: string, body: Buffer, contentType?: string, extOverride?: string): Promise<StoredObject> {
    const ext = extOverride || this.inferExtFromContentType(contentType) || '';
    const key = `${folder}/${baseName}${ext}`;

    if (this.driver === 'cos') {
      await this.cosPutObject(key, body, contentType ?? this.inferContentTypeFromKey(key));
      return { ossKey: key, url: this.toObjectUrl(key), contentType, size: body.length };
    }

    await this.localWriteFile(key, body);
    return { ossKey: key, url: this.toObjectUrl(key), contentType, size: body.length };
  }

  private async loadToBuffer(urlOrBase64: string) {
    if (isHttpUrl(urlOrBase64)) return this.fetchUrlToBuffer(urlOrBase64);
    return this.decodeBase64ToBuffer(urlOrBase64);
  }

  async saveImageResult(urlOrBase64: string, taskNo: string): Promise<StoredImageResult> {
    const { buffer, contentType } = await this.loadToBuffer(urlOrBase64);
    const originalExt = this.inferExtFromUrl(urlOrBase64) || this.inferExtFromContentType(contentType) || '.png';

    const original = await this.putObject('images', taskNo, buffer, contentType, originalExt);

    const thumbBuffer = await sharp(buffer)
      .resize({ width: 512, withoutEnlargement: true })
      .jpeg({ quality: 80 })
      .toBuffer();
    const thumbBaseName = `${taskNo}_thumb_${sha1Hex(thumbBuffer).slice(0, 8)}`;
    const thumbnail = await this.putObject('thumbnails', thumbBaseName, thumbBuffer, 'image/jpeg', '.jpg');

    return { original, thumbnail };
  }

  async saveVideoThumbnailFromVideoUrl(videoUrl: string, taskNo: string): Promise<StoredObject> {
    // For COS driver we can use Tencent CI snapshot processing to extract first frame,
    // then upload the snapshot image as a real object.
    if (this.driver !== 'cos') {
      throw new Error('Video thumbnail generation is only supported when STORAGE_DRIVER=cos');
    }

    // Try "first frame" time=0; fall back to 0.001 and 1s for compatibility.
    const candidateTimes = ['0', '0.001', '1'];
    let lastErr: unknown = null;

    for (const t of candidateTimes) {
      try {
        const snapshotUrl = `${videoUrl}?ci-process=snapshot&time=${encodeURIComponent(t)}&format=jpg`;
        const { buffer, contentType } = await this.fetchUrlToBuffer(snapshotUrl, 120_000);

        const thumbBaseName = `${taskNo}_thumb_${sha1Hex(buffer).slice(0, 8)}`;
        return await this.putObject('thumbnails', thumbBaseName, buffer, contentType ?? 'image/jpeg', '.jpg');
      } catch (err) {
        lastErr = err;
      }
    }

    throw lastErr instanceof Error ? lastErr : new Error('Failed to generate video thumbnail');
  }

  private appendQueryToUrl(url: string, query: Record<string, CosProcessQueryValue>) {
    const target = new URL(url);
    for (const [key, value] of Object.entries(query)) {
      target.searchParams.set(key, String(value));
    }
    return target.toString();
  }

  private async getSignedCosObjectUrl(key: string, query: Record<string, CosProcessQueryValue>) {
    if (!this.cos || !this.cosBucket || !this.cosRegion) {
      throw new Error('COS not configured');
    }

    return await new Promise<string>((resolve, reject) => {
      (this.cos as any).getObjectUrl(
        {
          Bucket: this.cosBucket,
          Region: this.cosRegion,
          Key: key,
          Query: query,
          Sign: true,
        },
        (err: any, data: any) => {
          if (err) {
            reject(err);
            return;
          }

          const url = typeof data?.Url === 'string' ? data.Url.trim() : '';
          if (!url) {
            reject(new Error('Failed to generate signed COS object URL'));
            return;
          }

          resolve(url);
        },
      );
    });
  }

  private async buildCosProcessingUrl(input: {
    videoUrl: string;
    objectKey?: string | null;
    query: Record<string, CosProcessQueryValue>;
  }) {
    if (input.objectKey && this.driver === 'cos') {
      try {
        return await this.getSignedCosObjectUrl(input.objectKey, input.query);
      } catch {
        // Fall back to the public object URL when signing fails.
      }
    }

    return this.appendQueryToUrl(input.videoUrl, input.query);
  }

  private toPositiveNumber(value: unknown) {
    const numeric =
      typeof value === 'number'
        ? value
        : typeof value === 'string'
          ? Number.parseFloat(value)
          : Number.NaN;
    return Number.isFinite(numeric) && numeric > 0 ? numeric : null;
  }

  private extractVideoDurationFromAvinfo(payload: CosAvinfoResponse) {
    const candidates: unknown[] = [
      payload?.format?.duration,
      payload?.video?.duration,
      ...(payload?.streams ?? [])
        .filter((stream) => stream?.codec_type === 'video')
        .map((stream) => stream?.duration),
    ];

    for (const candidate of candidates) {
      const duration = this.toPositiveNumber(candidate);
      if (duration !== null) return duration;
    }

    return null;
  }

  private formatSnapshotTime(seconds: number) {
    const normalized = Math.max(0, seconds);
    const fixed = normalized.toFixed(3);
    return fixed.replace(/\.?0+$/, '') || '0';
  }

  private buildLastFrameCandidateTimes(durationSeconds: number) {
    const offsets = [0.001, 0.03, 0.1];
    const seen = new Set<string>();
    const times: string[] = [];

    for (const offset of offsets) {
      const time = this.formatSnapshotTime(Math.max(durationSeconds - offset, 0));
      if (seen.has(time)) continue;
      seen.add(time);
      times.push(time);
    }

    if (times.length === 0) {
      times.push('0');
    }

    return times;
  }

  async saveVideoLastFrameFromVideoUrl(input: {
    videoUrl: string;
    objectKey?: string | null;
    taskNo: string;
    durationSeconds?: number | null;
  }): Promise<StoredObject> {
    if (this.driver !== 'cos') {
      throw new Error('Video last-frame extraction is only supported when STORAGE_DRIVER=cos');
    }

    let durationSeconds: number | null = null;
    try {
      const avinfoUrl = await this.buildCosProcessingUrl({
        videoUrl: input.videoUrl,
        objectKey: input.objectKey ?? null,
        query: {
          'ci-process': 'avinfo',
        },
      });
      const avinfo = await this.fetchUrlToJson<CosAvinfoResponse>(avinfoUrl, 120_000);
      durationSeconds = this.extractVideoDurationFromAvinfo(avinfo);
    } catch {
      durationSeconds = null;
    }

    durationSeconds = durationSeconds ?? this.toPositiveNumber(input.durationSeconds);
    if (durationSeconds === null) {
      throw new Error('Failed to resolve video duration from COS avinfo or task duration');
    }

    let lastErr: unknown = null;
    for (const time of this.buildLastFrameCandidateTimes(durationSeconds)) {
      try {
        const snapshotUrl = await this.buildCosProcessingUrl({
          videoUrl: input.videoUrl,
          objectKey: input.objectKey ?? null,
          query: {
            'ci-process': 'snapshot',
            time,
            format: 'jpg',
            rotate: 'auto',
            mode: 'exactframe',
          },
        });
        const { buffer, contentType } = await this.fetchUrlToBuffer(snapshotUrl, 120_000);
        const baseName = `${input.taskNo}_last_${sha1Hex(buffer).slice(0, 8)}`;
        return await this.putObject('thumbnails', baseName, buffer, contentType ?? 'image/jpeg', '.jpg');
      } catch (err) {
        lastErr = err;
      }
    }

    throw lastErr instanceof Error ? lastErr : new Error('Failed to generate video last frame');
  }

  async saveVideoResult(urlOrBase64: string, taskNo: string): Promise<StoredObject> {
    if (isHttpUrl(urlOrBase64)) {
      const { stream, contentType, contentLength } = await this.fetchUrlToStream(urlOrBase64);
      const ext = this.inferExtFromUrl(urlOrBase64) || this.inferExtFromContentType(contentType) || '.mp4';
      const key = `videos/${taskNo}${ext}`;

      if (this.driver === 'cos') {
        await this.cosPutObjectStream(key, stream, contentType ?? this.inferContentTypeFromKey(key), contentLength);
        return { ossKey: key, url: this.toObjectUrl(key), contentType, size: contentLength };
      }

      await this.localWriteStream(key, stream);
      return { ossKey: key, url: this.toObjectUrl(key), contentType, size: contentLength };
    }

    const { buffer, contentType } = this.decodeBase64ToBuffer(urlOrBase64);
    const ext = this.inferExtFromContentType(contentType) || '.mp4';
    return this.putObject('videos', taskNo, buffer, contentType, ext);
  }

  async uploadVideoInput(
    fileBuffer: Buffer,
    originalName: string,
    kind: VideoInputUploadKind,
    contentType?: string,
  ): Promise<StoredObject> {
    const ext = extname(originalName) || this.inferExtFromContentType(contentType) || '';
    const baseName = `input_${Date.now()}_${sha1Hex(fileBuffer).slice(0, 12)}`;
    const resolvedContentType = contentType ?? ((mimeLookup(originalName) || undefined) as string | undefined);
    return this.putObject(getVideoInputFolder(kind), baseName, fileBuffer, resolvedContentType, ext);
  }

  async uploadAvatar(fileBuffer: Buffer, originalName: string, userId: bigint): Promise<StoredObject> {
    const ext = extname(originalName) || '.jpg';
    const baseName = `avatar_${userId.toString()}_${Date.now()}_${sha1Hex(fileBuffer).slice(0, 8)}`;
    const contentType = (mimeLookup(originalName) || undefined) as string | undefined;
    return this.putObject('avatars', baseName, fileBuffer, contentType, ext);
  }

  async saveProjectImageUpload(
    fileBuffer: Buffer,
    originalName: string,
    contentType?: string,
  ): Promise<StoredProjectAssetResult> {
    const resolvedContentType = contentType ?? ((mimeLookup(originalName) || undefined) as string | undefined);
    const originalExt = extname(originalName) || this.inferExtFromContentType(resolvedContentType) || '.png';
    const baseName = `project_img_${Date.now()}_${sha1Hex(fileBuffer).slice(0, 12)}`;

    const original = await this.putObject('project-assets/images', baseName, fileBuffer, resolvedContentType, originalExt);
    const thumbBuffer = await sharp(fileBuffer)
      .resize({ width: 512, withoutEnlargement: true })
      .jpeg({ quality: 80 })
      .toBuffer();
    const thumbBaseName = `${baseName}_thumb_${sha1Hex(thumbBuffer).slice(0, 8)}`;
    const thumbnail = await this.putObject('project-assets/thumbnails', thumbBaseName, thumbBuffer, 'image/jpeg', '.jpg');

    return { original, thumbnail };
  }

  async saveProjectVideoUpload(
    fileBuffer: Buffer,
    originalName: string,
    contentType?: string,
  ): Promise<StoredProjectAssetResult> {
    const resolvedContentType = contentType ?? ((mimeLookup(originalName) || undefined) as string | undefined);
    const ext = extname(originalName) || this.inferExtFromContentType(resolvedContentType) || '.mp4';
    const baseName = `project_vid_${Date.now()}_${sha1Hex(fileBuffer).slice(0, 12)}`;
    const original = await this.putObject('project-assets/videos', baseName, fileBuffer, resolvedContentType, ext);

    let thumbnail: StoredObject | null = null;
    try {
      thumbnail = await this.saveVideoThumbnailFromVideoUrl(original.url, baseName);
    } catch {
      thumbnail = null;
    }

    return { original, thumbnail };
  }

  async saveProjectDocumentUpload(
    fileBuffer: Buffer,
    originalName: string,
    contentType?: string,
  ): Promise<StoredProjectAssetResult> {
    const resolvedContentType = contentType ?? ((mimeLookup(originalName) || undefined) as string | undefined);
    const ext = extname(originalName) || '.bin';
    const baseName = `project_doc_${Date.now()}_${sha1Hex(fileBuffer).slice(0, 12)}`;
    const original = await this.putObject('project-assets/documents', baseName, fileBuffer, resolvedContentType, ext);
    return { original, thumbnail: null };
  }
}
