import { z } from 'zod'
import {
  AUDIO_FORMATS,
  BROWSERS,
  CONTAINERS,
  COOKIES_MODES,
  LANGUAGES,
  MAX_BATCH_SIZE,
  MAX_HEIGHT,
  MAX_URL_LENGTH,
  MIN_HEIGHT,
  THEMES
} from './constants'
import { isValidFilenameTemplate, isValidSubtitleLangs } from './filename'
import { validateUrl } from './url'

export const urlInputSchema = z
  .string()
  .trim()
  .min(1)
  .max(MAX_URL_LENGTH)
  .superRefine((value, ctx) => {
    const result = validateUrl(value)
    if (!result.ok) {
      ctx.addIssue({ code: 'custom', message: result.code })
    }
  })

export const subtitleOptionsSchema = z
  .object({
    enabled: z.boolean(),
    langs: z.string().max(100)
  })
  .strict()
  .superRefine((value, ctx) => {
    if (value.enabled && !isValidSubtitleLangs(value.langs)) {
      ctx.addIssue({ code: 'custom', message: 'invalid subtitle language list', path: ['langs'] })
    }
  })

export const downloadRequestSchema = z
  .object({
    url: urlInputSchema,
    title: z.string().max(500).optional(),
    id: z.string().max(200).optional(),
    uploader: z.string().max(200).optional(),
    thumbnail: z.string().max(MAX_URL_LENGTH).optional(),
    mode: z.enum(['video', 'audio']),
    height: z.number().int().min(MIN_HEIGHT).max(MAX_HEIGHT).nullable(),
    container: z.enum(CONTAINERS),
    audioFormat: z.enum(AUDIO_FORMATS),
    subtitles: subtitleOptionsSchema,
    playlist: z.boolean()
  })
  .strict()
  .superRefine((value, ctx) => {
    if (value.mode === 'audio' && value.subtitles.enabled) {
      ctx.addIssue({ code: 'custom', message: 'subtitles are not available for audio-only downloads', path: ['subtitles'] })
    }
  })

export const batchRequestSchema = z.array(downloadRequestSchema).min(1).max(MAX_BATCH_SIZE)

export const probePayloadSchema = z.object({ url: urlInputSchema }).strict()

export const jobIdSchema = z.string().uuid()

export const settingsPatchSchema = z
  .object({
    downloadDir: z.string().max(1024).optional(),
    filenameTemplate: z.string().max(100).optional(),
    theme: z.enum(THEMES).optional(),
    language: z.enum(LANGUAGES).optional(),
    subtitleEnabled: z.boolean().optional(),
    subtitleLangs: z.string().max(100).optional(),
    cookiesMode: z.enum(COOKIES_MODES).optional(),
    cookiesBrowser: z.enum(BROWSERS).optional(),
    maxConcurrent: z.number().int().min(1).max(3).optional()
  })
  .strict()
  .superRefine((value, ctx) => {
    if (value.filenameTemplate !== undefined && !isValidFilenameTemplate(value.filenameTemplate)) {
      ctx.addIssue({ code: 'custom', message: 'invalid filename template', path: ['filenameTemplate'] })
    }
    if (value.subtitleLangs !== undefined && !isValidSubtitleLangs(value.subtitleLangs)) {
      ctx.addIssue({ code: 'custom', message: 'invalid subtitle language list', path: ['subtitleLangs'] })
    }
    if (value.downloadDir !== undefined && /[\u0000-\u001f]/.test(value.downloadDir)) {
      ctx.addIssue({ code: 'custom', message: 'invalid download directory', path: ['downloadDir'] })
    }
  })

export const settingsSchema = z
  .object({
    downloadDir: z.string().min(1).max(1024),
    filenameTemplate: z.string().min(1).max(100),
    theme: z.enum(THEMES),
    language: z.enum(LANGUAGES),
    subtitleEnabled: z.boolean(),
    subtitleLangs: z.string().max(100),
    cookiesMode: z.enum(COOKIES_MODES),
    cookiesBrowser: z.enum(BROWSERS),
    maxConcurrent: z.number().int().min(1).max(3),
    acceptedTermsVersion: z.number().int().min(0),
    acceptedTermsAt: z.string().max(40).nullable()
  })
  .strict()

export const updateApplySchema = z.object({ confirm: z.literal(true) }).strict()

export const emptyPayloadSchema = z.undefined().optional()
