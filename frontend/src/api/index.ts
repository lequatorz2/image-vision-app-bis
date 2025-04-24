import axios from 'axios';
import { Image } from '../types';

const API_BASE_URL = 'http://localhost:3001/api';

// Create axios instance with base configuration
const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Get all images
export const fetchImages = async (): Promise<Image[]> => {
  try {
    const response = await api.get('/images');
    return response.data;
  } catch (error) {
    console.error('Error fetching images:', error);
    throw error;
  }
};

// Get single image by ID
export const fetchImageById = async (id: string): Promise<Image> => {
  try {
    const response = await api.get(`/images/${id}`);
    return response.data;
  } catch (error) {
    console.error(`Error fetching image with ID ${id}:`, error);
    throw error;
  }
};

// Search images with query and filters
export const searchImages = async (query: string, filters: Record<string, string> = {}): Promise<Image[]> => {
  try {
    const response = await api.post('/search', { query, filters });
    return response.data;
  } catch (error) {
    console.error('Error searching images:', error);
    throw error;
  }
};

// Natural language search with AI processing
export const naturalLanguageSearch = async (query: string): Promise<{
  results: Image[];
  extractedCriteria: {
    filters: Record<string, string>;
    keywords: string[];
  };
}> => {
  try {
    const response = await api.post('/natural-search', { query });
    return response.data;
  } catch (error) {
    console.error('Error performing natural language search:', error);
    throw error;
  }
};

// Get related images for a specific image
export const fetchRelatedImages = async (id: string): Promise<Image[]> => {
  try {
    const response = await api.get(`/images/related/${id}`);
    return response.data;
  } catch (error) {
    console.error(`Error fetching related images for ID ${id}:`, error);
    throw error;
  }
};

// Get statistics about the image collection
export const fetchStats = async (): Promise<any> => {
  try {
    const response = await api.get('/stats');
    return response.data;
  } catch (error) {
    console.error('Error fetching stats:', error);
    throw error;
  }
};

// Upload images
export const uploadImages = async (files: File[]): Promise<{ images: Image[] }> => {
  try {
    const formData = new FormData();
    files.forEach(file => {
      formData.append('images', file);
    });
    
    const response = await axios.post(`${API_BASE_URL}/upload`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    
    return response.data;
  } catch (error) {
    console.error('Error uploading images:', error);
    throw error;
  }
};

export default {
  fetchImages,
  fetchImageById,
  searchImages,
  naturalLanguageSearch,
  fetchRelatedImages,
  fetchStats,
  uploadImages,
};