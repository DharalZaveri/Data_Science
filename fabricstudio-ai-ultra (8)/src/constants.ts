import { Model } from './types';

export const POSES = [
  'Standing front view, high fashion pose',
  'Walking naturally towards the camera',
  'Three-quarters side view, looking away',
  'Sitting on a minimalist studio stool',
  'Back view showing garment details',
  'Action shot, dynamic jumping pose',
  'Leaning against a wall, casual style',
  'Crossed arms, strong confident look',
  'Close up detail shot of the upper garment',
  'Full body walking away, looking back',
  'Sitting on the floor, editorial style',
  'Hands in pockets, relaxed street style',
  'High fashion sitting pose on floor',
  'Side profile, dramatic lighting',
  'Over the shoulder look, soft expression',
  'Adjusting hair, lifestyle portrait',
  'Looking at a watch, executive professional style',
  'Holding a luxury handbag, accessory focus',
  'Legs crossed, sophisticated sitting pose',
  'Hand on chin, thoughtful editorial look',
  'Slow motion spin, showing fabric movement',
  'Tucking shirt into pockets, casual candid',
  'Arms raised, dynamic shape focus',
  'Leaning forward, intense gaze into camera',
  'Sitting on stairs, urban street style',
  // New Editorial & Dynamic Poses
  'Vogue-style dynamic twist, hand on hip',
  'Couture running pose, flowing fabric',
  'Modern architectural lean, sharp angles',
  'Retro film-noir silhouette, high contrast',
  'Streetwear crouch, looking into camera',
  'Floating editorial pose, zero gravity effect',
  'Dramatic cape-flip motion shot',
  'Urban industrial climb, athletic pose',
  'Minimalist box pose, clean lines',
  'High-speed motion blur walk',
  'Cinematic rain-slicked pavement walk',
  'Desert horizon gaze under clear daylight',
  'Vibrant neon-lit urban nightlife pose'
];

export const GARMENT_CATEGORIES = [
  'Saree', 'Dress', 'Kurti', 'Lehenga', 'Shirt', 'Top', 'Co-ord Set',
  'Casual Shirt', 'Formal Shirt', 'Casual T-Shirt', 'Jeans Pants', 
  'Formal Pants', 'Sherwani', 'Kurta (Men)', 'Indo-Western', 'Shorts', 
  'Trackpants', 'Tracksuit'
];

export const PREDEFINED_MODELS = [
  { id: 'predef-1', name: 'Aisha (South Asian)', url: 'https://images.unsplash.com/photo-1615241721721-cb21fb3fde28?auto=format&fit=crop&q=80', basePrompt: 'A beautiful young South Asian fashion model with a slender figure and elegant posture.' },
  { id: 'predef-2', name: 'Mia (European)', url: 'https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?auto=format&fit=crop&q=80', basePrompt: 'A stunning European fashion model with sharp facial features and professional editorial look.' },
  { id: 'predef-3', name: 'Elena (Latina)', url: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80', basePrompt: 'A gorgeous Latina fashion model with confident expression and elegant proportions.' },
  { id: 'predef-4', name: 'Chloe (East Asian)', url: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&q=80', basePrompt: 'A striking East Asian fashion model with minimalist style and calm demeanor.' },
  { id: 'predef-5', name: 'Nia (African American)', url: 'https://images.unsplash.com/photo-1531123897727-8f129e1688ce?auto=format&fit=crop&q=80', basePrompt: 'A fierce African American fashion model with strong bone structure and high fashion presence.' }
];

