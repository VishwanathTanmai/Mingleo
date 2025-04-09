import OpenAI from 'openai';

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
const AI_MODEL = "gpt-4o";

/**
 * AI service for image and filter enhancements
 */
export class AIService {
  /**
   * Analyze image content for improved filter application
   * @param imageBase64 Base64 encoded image data
   */
  async analyzeImage(imageBase64: string): Promise<ImageAnalysisResult> {
    try {
      const response = await openai.chat.completions.create({
        model: AI_MODEL,
        messages: [
          {
            role: "system",
            content: "You are an expert computer vision AI specializing in AR/VR filter creation. Your task is to analyze images for implementation of advanced AR/VR filters with the following priorities:\n\n1. Detect and map facial features with precise 3D coordinates for AR face filters\n2. Identify key objects and scene elements with spatial positions\n3. Determine prominent colors and visual themes\n4. Generate creative and contextually relevant filter suggestions for both face and world AR modes\n5. Recommend specific overlay elements, effects, and interactive components\n6. Provide detailed technical parameters that would help with filter implementation\n\nYour analysis should be thorough and technically detailed enough to allow direct implementation of filters."
          },
          {
            role: "user",
            content: [
              {
                type: "text",
                text: "Analyze this image for AR/VR filter application. Identify main subjects, faces, colors, and key elements. Suggest appropriate AR face and world effects."
              },
              {
                type: "image_url",
                image_url: {
                  url: `data:image/jpeg;base64,${imageBase64}`
                }
              }
            ],
          }
        ],
        response_format: { type: "json_object" },
        max_tokens: 2500, // Further increased to provide highly detailed AR/VR suggestions
      });

      const content = response.choices[0].message.content;
      if (!content) {
        return {
          success: false,
          error: "Empty response from AI"
        };
      }
      
      const result = JSON.parse(content);
      
      return {
        success: true,
        ...result
      };
    } catch (error) {
      console.error("Error in AI image analysis:", error);
      return {
        success: false,
        error: "Failed to analyze image with AI"
      };
    }
  }

  /**
   * Generate AR face filter parameters
   * @param imageBase64 Base64 encoded image data
   */
  async generateARFaceParams(imageBase64: string): Promise<ARFilterParams> {
    try {
      // First analyze the image to detect faces and key elements
      const analysis = await this.analyzeImage(imageBase64);
      
      if (!analysis.success || !analysis.faceDetection) {
        return {
          meshPoints: [],
          overlayElements: [],
          enhancementLevel: 0,
          effectType: "face",
          error: "No faces detected in image"
        };
      }
      
      const faceParams: ARFilterParams = {
        meshPoints: analysis.faceDetection.points || [],
        overlayElements: analysis.suggestedEffects?.face?.map((effect, index) => ({
          id: `face-effect-${index}`,
          type: effect.type,
          content: effect.content,
          position: effect.position,
          scale: effect.scale || 1.0
        })) || [],
        enhancementLevel: analysis.faceDetection.count > 0 ? 0.8 : 0.3,
        effectType: "face"
      };
      
      return faceParams;
    } catch (error) {
      console.error("Error generating AR face parameters:", error);
      return {
        meshPoints: [],
        overlayElements: [],
        enhancementLevel: 0,
        effectType: "face",
        error: "Failed to generate AR face parameters"
      };
    }
  }

  /**
   * Generate AR world filter parameters
   * @param imageBase64 Base64 encoded image data
   */
  async generateARWorldParams(imageBase64: string): Promise<ARFilterParams> {
    try {
      // First analyze the image to detect scene elements
      const analysis = await this.analyzeImage(imageBase64);
      
      if (!analysis.success) {
        return {
          meshPoints: [],
          overlayElements: [],
          enhancementLevel: 0,
          effectType: "world",
          error: "Failed to analyze image scene"
        };
      }
      
      // Filter out undefined positions
      const validKeyElementPositions = analysis.keyElements
        ?.map(element => element.position)
        ?.filter((pos): pos is {x: number; y: number; z: number} => !!pos) || [];
      
      const worldParams: ARFilterParams = {
        meshPoints: validKeyElementPositions,
        overlayElements: analysis.suggestedEffects?.world?.map((effect, index) => ({
          id: `world-effect-${index}`,
          type: effect.type,
          content: effect.content,
          position: effect.position,
          scale: effect.scale || 1.0
        })) || [],
        enhancementLevel: (analysis.keyElements && analysis.keyElements.length > 0) ? 0.75 : 0.4,
        effectType: "world"
      };
      
      return worldParams;
    } catch (error) {
      console.error("Error generating AR world parameters:", error);
      return {
        meshPoints: [],
        overlayElements: [],
        enhancementLevel: 0,
        effectType: "world",
        error: "Failed to generate AR world parameters"
      };
    }
  }

  /**
   * Generate VR environment parameters
   * @param imageBase64 Base64 encoded image data
   * @param vrType Type of VR environment ("space" or "party")
   */
  async generateVRParams(imageBase64: string, vrType: string): Promise<VRFilterParams> {
    try {
      // First analyze the image
      const analysis = await this.analyzeImage(imageBase64);
      
      if (!analysis.success) {
        return {
          environment: vrType,
          immersionLevel: 0.5,
          interactiveElements: [],
          lighting: {
            ambient: "#FFFFFF",
            intensity: 0.7,
            shadows: false
          },
          error: "Failed to analyze image"
        };
      }
      
      // Generate a prompt based on the image analysis for environment creation
      const environmentPrompt = `Create a detailed ${vrType} VR environment based on these image elements: 
Main subject: ${analysis.mainSubjectType || "generic scene"}
Colors: ${analysis.prominentColors?.join(", ") || "default"}
Key elements: ${analysis.keyElements?.map(el => el.name).join(", ") || "none detected"}
Number of interactive objects: ${analysis.keyElements?.length || 0}

Please provide a highly detailed VR environment with:
1. A descriptive environment setting that matches the image mood and subject
2. At least 5-7 interactive elements with positions and specific actions
3. Detailed lighting settings including ambient color, intensity and shadow settings
4. Immersion level between 0-1 based on image complexity
5. Any special effects or atmospheric elements that would enhance the experience`;
      
      const response = await openai.chat.completions.create({
        model: AI_MODEL,
        messages: [
          {
            role: "system",
            content: "You are an expert VR environment designer with extensive experience creating interactive, immersive 3D spaces. Your task is to generate comprehensive and technically detailed VR environment specifications based on image analysis. Your response should include:\n\n1. A rich, atmospheric environment description matching the input image's theme and mood\n2. Precise 3D positioning data for all interactive elements (coordinates in x,y,z format)\n3. Detailed lighting configuration (ambient color in hex, intensity values, shadow settings)\n4. Immersion level calibration (0.0-1.0 scale) with justification\n5. At least 5-7 unique interactive elements with specific actions and triggers\n6. Physical properties of the environment (gravity, sound reflection, etc.)\n7. Any special rendering effects or particle systems needed\n\nProvide output that could be directly implemented in a VR development framework."
          },
          {
            role: "user",
            content: environmentPrompt
          }
        ],
        response_format: { type: "json_object" },
        max_tokens: 2000, // Further increased from 1200 to provide extremely detailed VR environment parameters
      });

      const content = response.choices[0].message.content;
      if (!content) {
        return {
          environment: vrType,
          immersionLevel: 0.5,
          interactiveElements: [],
          lighting: {
            ambient: "#FFFFFF",
            intensity: 0.7,
            shadows: false
          },
          error: "Empty response from AI"
        };
      }
      
      const vrEnvironment = JSON.parse(content);
      
      const vrParams: VRFilterParams = {
        environment: vrType,
        immersionLevel: vrEnvironment.immersionLevel || 0.7,
        interactiveElements: vrEnvironment.interactiveElements || analysis.keyElements?.map((element, index) => ({
          id: `vr-element-${index}`,
          type: element.type,
          position: element.position || { x: 0, y: 0, z: 0 },
          action: `interact-with-${element.type}`
        })) || [],
        lighting: vrEnvironment.lighting || {
          ambient: analysis.prominentColors?.[0] || "#FFFFFF",
          intensity: 0.8,
          shadows: true
        }
      };
      
      return vrParams;
    } catch (error) {
      console.error("Error generating VR parameters:", error);
      return {
        environment: vrType,
        immersionLevel: 0.5,
        interactiveElements: [],
        lighting: {
          ambient: "#FFFFFF",
          intensity: 0.7,
          shadows: false
        },
        error: "Failed to generate VR parameters"
      };
    }
  }
}

export const aiService = new AIService();

// Type definitions for AI service interfaces
export interface ImageAnalysisResult {
  success: boolean;
  mainSubjectType?: string;
  faceDetection?: {
    count: number;
    points: Array<{ x: number; y: number; z: number; }>;
  };
  prominentColors?: string[];
  keyElements?: Array<{
    name: string;
    type: string;
    position?: { x: number; y: number; z: number; };
    scale?: number;
  }>;
  suggestedEffects?: {
    face?: Array<{
      type: string;
      content: string;
      position: { x: number; y: number; z: number; };
      scale?: number;
    }>;
    world?: Array<{
      type: string;
      content: string;
      position: { x: number; y: number; z: number; };
      scale?: number;
    }>;
  };
  error?: string;
}

export interface ARFilterParams {
  meshPoints: Array<{ x: number; y: number; z: number; }>;
  overlayElements: Array<{
    id: string;
    type: string;
    position: { x: number; y: number; z: number; };
    content: string;
    scale: number;
  }>;
  enhancementLevel: number;
  effectType: "face" | "world";
  error?: string;
}

export interface VRFilterParams {
  environment: string;
  immersionLevel: number;
  interactiveElements: Array<{
    id: string;
    type: string;
    position: { x: number; y: number; z: number; };
    action: string;
  }>;
  lighting: {
    ambient: string;
    intensity: number;
    shadows: boolean;
  };
  error?: string;
}