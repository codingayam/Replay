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

const SYNCHRONOUS_FOCUS = {
  general: `Let the session feel unhurried and restorative. Invite steady breathing, moments of silence, and gentle encouragement that guides the listener toward a grounded close with space to rest and integrate.`,
  intention: `Guide the listener through a mindful intention-setting sequence. Help them notice key themes from their experiences, articulate what matters most, and name one or two intentional focal points they can carry forward.`,
  calm: `Lead the listener into progressively deeper relaxation. Use body-based cues, soft imagery, and longer pauses that help dissolve tension and settle the nervous system before a soothing close.`,
  gratitude: `Center the meditation on appreciation. Surface meaningful details from their reflections, encourage them to linger with the sensations of thankfulness, and close with an invitation to continue noticing everyday gifts.`,
  compassion: `Weave in a loving-kindness (metta) segment tailored to their reflections. Begin with self-compassion, extend to loved ones, then to neutral or challenging relationships, and close by offering understanding to any difficult situations they mentioned.`
};

const BACKGROUND_FOCUS = {
  general: `Let the arc feel restorative. Incorporate breath cues, soft imagery, and gentle direction that supports winding down and integrating the insights that surface.`,
  intention: `Craft a daybreak-style experience that grounds the listener, highlights inspiring details from their reflections, and prompts them to visualize—and commit to—their next steps with clarity.`,
  calm: `Emphasize slow pacing and somatic calm. Suggest body scans, relaxed breathing patterns, and tranquil imagery so the nervous system can downshift before a peaceful close.`,
  gratitude: `Invite the listener to dwell on people, moments, or lessons they feel thankful for. Allow space for naming specific appreciations and closing with a warm, heartfelt acknowledgement.`,
  compassion: `Include a loving-kindness section that references the relationships and challenges in their reflections. Offer phrases such as "May you be happy, may you be healthy, may you be free from suffering" as you widen the circle of care.`
};

function sanitizeContext(context) {
  if (!context || typeof context !== 'string') {
    return '';
  }
  const trimmed = context.trim();
  return trimmed ? `${trimmed}

` : '';
}

function buildSynchronousCore({ duration, profileContext, experiencesText, focus }) {
  const contextBlock = sanitizeContext(profileContext);
  return `You are an experienced meditation practitioner. You are great at taking raw experiences and sensory data and converting them into a ${duration}-minute meditation session. Your role is to provide a focused, reflective space for life's meaningful moments. The guided reflection should be thoughtful and not cloying, with pauses for quiet reflection using the format [PAUSE=Xs], where X is the number of seconds. You are trusted to decide on the duration and number of pauses. Only add pauses where they naturally support deeper contemplation.

${contextBlock}Experiences:
${experiencesText}

${focus}

IMPORTANT: Write the script as plain spoken text only. Do not use markdown formatting or asterisks. You may only represent pauses using [PAUSE=Xs], and there should not be any pauses after the final spoken segment.`;
}

function buildBackgroundCore({ duration, profileContext, experiencesText, focus }) {
  const contextBlock = sanitizeContext(profileContext);
  return `You are an experienced meditation practitioner. You are great at taking raw experiences and sensory data and converting them into a ${duration}-minute meditation session. The guided reflection should feel supportive and steady, with pauses noted as [PAUSE=Xs] where X is the number of seconds. Use the listener's personal context to shape the arc of the session.

${contextBlock}Experiences:
${experiencesText}

${focus}

IMPORTANT: Write the script as plain spoken text only. Do not use markdown formatting or asterisks. Do not include pauses after the final spoken segment.`;
}

export function buildSynchronousMeditationScriptPrompt({ reflectionType, duration, profileContext, experiencesText }) {
  const type = normalizeMeditationType(reflectionType);
  const focus = SYNCHRONOUS_FOCUS[type] ?? SYNCHRONOUS_FOCUS.general;
  return buildSynchronousCore({ duration, profileContext, experiencesText, focus });
}

export function buildBackgroundMeditationScriptPrompt({ reflectionType, duration, profileContext, experiencesText }) {
  const type = normalizeMeditationType(reflectionType);
  const focus = BACKGROUND_FOCUS[type] ?? BACKGROUND_FOCUS.general;
  return buildBackgroundCore({ duration, profileContext, experiencesText, focus });
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
