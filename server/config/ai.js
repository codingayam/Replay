// Centralized AI configuration: model identifiers and prompt builders

export const GEMINI_MODELS = {
  default: 'gemini-2.5-flash-lite',
  transcription: 'gemini-2.0-flash'
};

const defaultReplicateOwner = process.env.REPLICATE_DEPLOYMENT_OWNER ?? 'codingayam';
const defaultReplicateName = process.env.REPLICATE_DEPLOYMENT_NAME ?? 'kokoro-replay';

export const REPLICATE_DEPLOYMENTS = {
  tts: {
    owner: defaultReplicateOwner,
    name: defaultReplicateName
  }
};

export const AUDIO_TRANSCRIPTION_PROMPT = 'Please transcribe this audio recording. Return only the transcribed text without any additional formatting or commentary.';

export const MEDITATION_TYPE_LABELS = {
  general: 'General Meditation',
  intention: 'Intention Setting',
  calm: 'Calmness & Relaxation',
  gratitude: 'Gratitude',
  compassion: 'Compassion'
};

export const DEFAULT_MEDITATION_TYPE = 'general';

export function normalizeMeditationType(value) {
  if (!value) {
    return DEFAULT_MEDITATION_TYPE;
  }

  if (typeof value === 'string') {
    const trimmed = value.trim().toLowerCase();
    if (trimmed in MEDITATION_TYPE_LABELS) {
      return trimmed;
    }

    if (trimmed === 'night' || trimmed === 'night meditation') {
      return 'general';
    }

    if (trimmed === 'day' || trimmed === 'day meditation') {
      return 'intention';
    }

    if (trimmed === 'calmness and relaxation' || trimmed === 'calmness & relaxation' || trimmed === 'calm') {
      return 'calm';
    }

    if (trimmed === 'intention setting') {
      return 'intention';
    }

    if (trimmed === 'general meditation' || trimmed === 'general') {
      return 'general';
    }

    if (trimmed === 'compassion') {
      return 'compassion';
    }

    if (trimmed === 'gratitude') {
      return 'gratitude';
    }
  }

  return DEFAULT_MEDITATION_TYPE;
}

export function buildBackgroundMeditationTitlePrompt(script) {
  return `
    You will receive the full script of a guided meditation or reflection session.
    Analyse it and respond with JSON only in this shape:
    {
      "title": "Short descriptive title",
      "summary": "At most three sentences summarising the session."
    }

    Requirements:
    - The title must be fewer than 12 words.
    - The summary must be under 350 characters and no more than three sentences.
    - Do not include markdown or extraneous commentary.

    Script:
    """
    ${script}
    """
  `;
}

export function buildMeditationTitlePrompt(script) {
  return `
      You will receive the full script of a guided meditation session.
      Analyse the content and respond with a concise JSON object using this shape:
      {
        "title": "Short, evocative meditation title",
        "summary": "A short overview, maximum three sentences."
      }

      Requirements:
      - The title must be fewer than 12 words.
      - The summary must not exceed three sentences and should stay under 350 characters.
      - Capture the core themes, tone, and intent of the meditation.
      - Do not include markdown, quotes, or escape sequences.

      Meditation script:
      """
      ${script}
      """
    `;
}

export function buildReflectionSummaryPrompt({ profileContext, experiencesText, timeOfReflection }) {
  return `
          Create a thoughtful reflection summary for a guided meditation based on these personal experiences:
        
          ${profileContext}
        
          Experiences:
          ${experiencesText}
        
          Time of reflection: ${timeOfReflection || 'Now'}
        
          Generate a warm, personal reflection that:
          1. Identifies key themes and patterns
          2. Highlights growth and insights
          3. Connects experiences to values and mission
          4. Prepares the mind for meditation
        
          Keep it meaningful but concise (2-3 paragraphs).
        `;
}

const MEDITATION_TYPE_PROMPTS = {
  general: ``,
  intention: `Guide the listener through an intention-setting journey. Your focus is on guiding the listener to connect with their inner wisdom and values, Include reflective prompts to help identify what truly matters to them, Lead them through visualizing their intention clearly and vividly, Incorporate affirmations or phrases they can anchor to their intention, Use language that feels expansive and empowering rather than restrictive, Include a practice for embedding the intention into the body/heart and Close with a gentle return to awareness and a commitment to carry the intention forward`,
  calm: `Lead the listener into deep ease. Open with immediate grounding techniques to help regulate the nervous system (body scan, 5 senses awareness, or progressive muscle relaxation), Use slow, rhythmic breathing exercises (such as 4-7-8 breathing or extended exhales); Incorporate soothing, reassuring language that validates their feelings without judgment; Guide them to create a mental 'safe space' or calm visualization (beach, forest, warm light, etc.); Include techniques for releasing tension and worry (visualizing worries floating away, releasing on the exhale, etc.); Use repetitive, anchoring phrases like 'I am safe,' 'This moment is enough,' or 'I am grounded'; Address racing thoughts gently, teaching observation without attachment; Build in longer pauses for silent rest and integration; Close with gentle affirmations of their resilience and capacity for calm; End with a soft transition back to the present moment; Use a slow, steady pace with a compassionate, almost whisper-like tone. Avoid any urgency or pressure.`,
  gratitude: `Center the session on appreciation. Surface specific people, moments, or lessons from their experiences and encourage lingering with the sensations of thankfulness, ending with an invitation to keep noticing everyday gifts.`,
  compassion: `Weave a loving-kindness (metta) segment tailored to their reflections. Begin with self-compassion, extend to loved ones, then outward to neutral or challenging relationships if there are any mentioned, and conclude by offering understanding to any difficult situations they mentioned.`
};

function sanitizeContext(context) {
  if (!context || typeof context !== 'string') {
    return '';
  }
  const trimmed = context.trim();
  return trimmed ? `${trimmed}

` : '';
}

export function buildMeditationScriptPrompt({ reflectionType, duration, profileContext, experiencesText }) {
  const type = normalizeMeditationType(reflectionType);
  const focus = MEDITATION_TYPE_PROMPTS[type] ?? MEDITATION_TYPE_PROMPTS.general;
  const safeDuration = Number.isFinite(duration) && duration > 0 ? duration : 5;
  const contextBlock = sanitizeContext(profileContext);
  const baseInstructions = `You are an experienced meditation practitioner. You are great at taking raw experiences and sensory data and converting them into a ${safeDuration}-minute meditation session. Your role is to provide a focused, reflective space for life's meaningful moments. The guided reflection should be thoughtful and not cloying, with pauses for quiet reflection using the format [PAUSE=Xs], where X is the number of seconds. You are trusted to decide on the duration and number of pauses. Only add pauses where they naturally support deeper contemplation.

${contextBlock}Experiences:
${experiencesText}
`;

  return `${baseInstructions}

${focus}

IMPORTANT: Write the script as plain spoken text only. Do not use markdown formatting or asterisks. You may only represent pauses using [PAUSE=Xs], and there should not be any pauses after the final spoken segment.`;
}

export function buildWeeklyReportPrompt({ notesDigest, meditationsDigest, profileSection, weekStart, timezone, profileValues }) {
  return `You are a thoughtful coach and facilitator helping someone gain deeper self-understanding through their own reflections and thoughts. Your role is to serve as a mirror and gentle guide, helping them see patterns, connections, and insights they may not have noticed themselves. 

    Core Approach
    -Never prescriptive: You don't tell them what to do or think. Instead, you help them discover their own answers
    -Pattern recognition: Identify recurring themes, concerns, or aspirations across their shared thoughts
    -Gentle illumination: Shine light on connections and insights without imposing interpretations
    -Curious questioning: Ask open-ended questions that deepen their self-exploration
    -Respectful witnessing: Honor their journey and validate their experiences while maintaining professional boundaries

    Your Process
    -Synthesize without reducing: Look for patterns across their reflections while preserving the richness of their individual thoughts
    -Notice the threads:
      What themes appear repeatedly?
      What values consistently emerge?
      Where do their energy and passion seem strongest?
      What tensions or paradoxes exist in their thinking?
    -Reflect back with care:
      "I notice you've mentioned [X] several times..."
      "There seems to be a connection between [Y] and [Z] in your reflections..."
      "Your thoughts about [topic] have evolved from [earlier view] to [current view]..."
    -Offer observations, not conclusions:
      Present what you notice as possibilities, not facts
      Use tentative language: "It seems...", "Perhaps...", "I wonder if..."
      Invite them to confirm, modify, or reject your observations
    -Ask powerful questions:
      "What does this pattern tell you about yourself?"
      "How does this align with your stated values of [X]?"
      "What might be possible if you fully embraced this aspect of yourself?"
      "Where else in your life do you see this theme playing out?"

    Key Areas to Explore
    -Alignment: How do their actions, thoughts, and stated values align or diverge?
    -Growth edges: Where are they stretching or challenging themselves?
    -Resistance points: What do they seem to avoid or struggle with repeatedly?
    -Energy sources: What consistently energizes or depletes them?
    -Evolution: How have their perspectives shifted over time?
    -Integration: How might separate insights connect into a larger understanding?

    Your Tone
    -Warm but professional
    -Curious without being intrusive
    -Supportive without enabling
    -Clear without being harsh
    -Encouraging growth while accepting where they are

    The person recorded their reflections during the week starting ${weekStart} in timezone ${timezone}.

    Output Structure
    -When providing your crystallized view:
      Opening reflection: Acknowledge the depth and breadth of what they've shared
    -Key patterns observed: Present major themes you've noticed
    -Connections and insights: Show how different elements of their reflections relate
    -Questions for deeper exploration: Offer powerful questions for them to consider
    -Affirmation: Recognize their growth, courage, or insights
    -Invitation: End with an open invitation for them to share what resonates and what they can continue to keep in mind or let ruminate in their subconscious as they go about their week.
    -Values: Based on what they've shared, identify the values that are most present in their reflections. You should try to ignore ${profileValues} as you set about doing this. The idea here is to identify values that are most present in their reflections, not the values they've explicitly stated. However, if values do overlap, that's ok as well. 

    IMPORTANT: You are not the expert on their life—they are. Your role is to help them see themselves more clearly through careful attention, pattern recognition, and thoughtful questioning. Trust their wisdom and capacity for self-discovery while providing the structure and reflection that facilitates deeper understanding. Be empathetic and kind - NEVER BE CRUEL, HARSH, JUDGEMENTAL OR CONDESCENDING.

    ${profileSection}Journal entries:
    ${notesDigest}

    Meditations completed:
    ${meditationsDigest}
    `;
}

export const PHOTO_VISION_PROMPT = 'Analyze this image in detail. Describe what you see including: objects, people, setting, colors, lighting, mood, and notable details. Provide a concise description in 1-3 sentences tailored for personal reflection.';

export const TEXT_NOTE_VISION_PROMPT = 'Analyze this supporting image for a written journal entry. Describe key visual elements, mood, and context in 1-2 sentences useful for reflection.';

export function buildPhotoTitlePrompt(combinedDescription) {
  return `Create a short, meaningful title (max 50 characters) for this combined photo description: "${combinedDescription}". Return only the title.`;
}

export function buildAudioNoteTitlePrompt(transcript) {
  return `Generate a short, meaningful title (max 50 characters) for this transcribed note: "${transcript}". 
            Return only the title text itself. Do not include quotes, labels, explanations, punctuation before/after, or any other text.`;
}
