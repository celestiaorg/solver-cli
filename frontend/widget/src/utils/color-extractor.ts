import { tryCatch } from "../lib/utils";

interface ColorData {
  r: number;
  g: number;
  b: number;
  count: number;
}

const FALLBACK_COLOR = "#6366f1";

class ColorCacheManager {
  private cache: Map<string, string>;
  private readonly storageKey = "logo-color-cache:v1";

  constructor() {
    this.cache = new Map<string, string>();
    this.loadFromStorage();
  }

  private loadFromStorage(): void {
    try {
      const stored = localStorage.getItem(this.storageKey);
      if (stored) {
        const data = JSON.parse(stored);
        this.cache = new Map(Object.entries(data));
      }
    } catch (error) {
      console.warn("Failed to load color cache from localStorage:", error);
    }
  }

  private saveToStorage(): void {
    try {
      const data = Object.fromEntries(this.cache);
      localStorage.setItem(this.storageKey, JSON.stringify(data));
    } catch (error) {
      console.warn("Failed to save color cache to localStorage:", error);
    }
  }

  has(key: string): boolean {
    return this.cache.has(key);
  }

  get(key: string): string | undefined {
    return this.cache.get(key);
  }

  set(key: string, value: string): void {
    this.cache.set(key, value);
    this.saveToStorage();
  }

  clear(): void {
    this.cache.clear();
    try {
      localStorage.removeItem(this.storageKey);
    } catch (error) {
      console.warn("Failed to clear color cache from localStorage:", error);
    }
  }
}

class ColorExtractor {
  private cacheManager: ColorCacheManager;

  constructor() {
    this.cacheManager = new ColorCacheManager();
  }

  private rgbToHex(r: number, g: number, b: number): string {
    return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
  }

  private rgbToHsl(
    r: number,
    g: number,
    b: number,
  ): { h: number; s: number; l: number } {
    r /= 255;
    g /= 255;
    b /= 255;

    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    let h = 0;
    let s = 0;
    const l = (max + min) / 2;

    if (max !== min) {
      const d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);

      switch (max) {
        case r:
          h = (g - b) / d + (g < b ? 6 : 0);
          break;
        case g:
          h = (b - r) / d + 2;
          break;
        case b:
          h = (r - g) / d + 4;
          break;
      }
      h /= 6;
    }

    return { h: h * 360, s: s * 100, l: l * 100 };
  }

  private quantizeColor(
    r: number,
    g: number,
    b: number,
    factor = 4,
  ): { r: number; g: number; b: number } {
    return {
      r: Math.round(r / factor) * factor,
      g: Math.round(g / factor) * factor,
      b: Math.round(b / factor) * factor,
    };
  }

  private processImageData(imageData: ImageData): string {
    const data = imageData.data;
    const colorMap = new Map<string, ColorData>();

    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const a = data[i + 3];

      if (a < 128) continue;

      const quantized = this.quantizeColor(r, g, b);
      const key = `${quantized.r},${quantized.g},${quantized.b}`;

      if (colorMap.has(key)) {
        colorMap.get(key)!.count++;
      } else {
        colorMap.set(key, {
          r: quantized.r,
          g: quantized.g,
          b: quantized.b,
          count: 1,
        });
      }
    }

    const sortedColors = Array.from(colorMap.values())
      .filter((color) => {
        const { l } = this.rgbToHsl(color.r, color.g, color.b);
        return l > 20 && l < 80;
      })
      .sort((a, b) => b.count - a.count);

    if (sortedColors.length === 0) {
      return FALLBACK_COLOR;
    }

    const dominantColor = sortedColors[0];
    return this.rgbToHex(dominantColor.r, dominantColor.g, dominantColor.b);
  }

  private extractColorFromImage(img: HTMLImageElement): Promise<string> {
    return new Promise((resolve) => {
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");

      if (!ctx) {
        resolve(FALLBACK_COLOR);
        return;
      }

      const size = Math.min(img.width, img.height, 100);
      canvas.width = size;
      canvas.height = size;

      ctx.drawImage(img, 0, 0, size, size);

      try {
        const imageData = ctx.getImageData(0, 0, size, size);
        const color = this.processImageData(imageData);
        resolve(color);
      } catch {
        resolve(FALLBACK_COLOR);
      }
    });
  }

  async getBackgroundColorFromLogoURL(logoURL: string): Promise<string> {
    if (!logoURL) {
      return FALLBACK_COLOR;
    }

    if (this.cacheManager.has(logoURL)) {
      return this.cacheManager.get(logoURL)!;
    }

    return new Promise((resolve) => {
      const img = new Image();
      img.crossOrigin = "anonymous";

      img.onerror = () => {
        this.cacheManager.set(logoURL, FALLBACK_COLOR);
        resolve(FALLBACK_COLOR);
      };

      const timeoutId = setTimeout(() => {
        this.cacheManager.set(logoURL, FALLBACK_COLOR);
        resolve(FALLBACK_COLOR);
      }, 5000);

      img.onload = async () => {
        clearTimeout(timeoutId);
        const [color] = await tryCatch(this.extractColorFromImage(img));

        this.cacheManager.set(logoURL, color || FALLBACK_COLOR);
        resolve(color || FALLBACK_COLOR);
      };

      img.src = logoURL;
    });
  }

  static hexToRgba(hex: string, opacity: number): string {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);

    return `rgba(${r}, ${g}, ${b}, ${opacity})`;
  }

  getBackgroundColorFromLogoURLSync(logoURL: string): string {
    if (!logoURL) {
      return FALLBACK_COLOR;
    }

    return this.cacheManager.get(logoURL) || FALLBACK_COLOR;
  }

  preloadLogoColor(logoURL: string): void {
    if (!logoURL || this.cacheManager.has(logoURL)) {
      return;
    }

    tryCatch(this.getBackgroundColorFromLogoURL(logoURL));
  }

  clearCache(): void {
    this.cacheManager.clear();
  }
}

const colorExtractor = new ColorExtractor();

export const getBackgroundColorFromLogoURL = async (
  logoURL: string,
): Promise<string> => {
  return colorExtractor.getBackgroundColorFromLogoURL(logoURL);
};

export const getBackgroundColorFromLogoURLSync = (logoURL: string): string => {
  return colorExtractor.getBackgroundColorFromLogoURLSync(logoURL);
};

export const preloadLogoColor = (logoURL: string): void => {
  colorExtractor.preloadLogoColor(logoURL);
};

export const clearColorCache = (): void => {
  colorExtractor.clearCache();
};
