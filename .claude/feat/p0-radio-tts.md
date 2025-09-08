Radio tts end point will call deep infra tts. So the script generated will probably be in this format, like because it's between radio hosts, so it will state clearly like what the speaker 1 say, what the speaker 2 say. Actually I don't want the, I think we don't have to send you know like speaker 1, speaker 2 etc to the TTS, so we will just send the text that is encapsulated between the columns for each, whenever each speaker speaks. For Speaker 1, use af_heart and Speaker 2, use am_puck. So eventually it will be a concatenation of the different, the two speakers each saying their piece, right? So it will be something like speaker one says, then speaker two says, and then back to speaker one says, etc. Right? And so when you're concatenating the different sentences together, I only want to leave a 0.35 seconds pause between each segment.

Example of transcript generated: 

Speaker 1: Good morning, good afternoon, good evening, and welcome back to The Thought Bubble, your weekly dose of big ideas from the people who are living them. I’m your host, Grace, and with me as always is my co-host, James.

Speaker 2: Great to be here, Grace! And today, we're diving into the mind of someone we both know, a friend of the show, XJ. He's been doing some serious thinking, and it's all about one big question: How do you make things that are hard to do as easy as playing a game?

Speaker 1: I love this because it's so relatable. We all have those things we know we should do but just...don't. Like going to the gym, or eating healthy.

Speaker 2: Exactly! And XJ has been looking at the work of legendary game designer Masahiro Sakurai for answers. One of the core ideas he’s latched onto is stress and release. He thinks that's the key.

Actual TTS:
Good morning, good afternoon, good evening, and welcome back to The Thought Bubble, your weekly dose of big ideas from the people who are living them. I’m your host, Grace, and with me as always is my co-host, James. 

[0.35s pause]

Great to be here, Grace! And today, we're diving into the mind of someone we both know, a friend of the show, XJ. He's been doing some serious thinking, and it's all about one big question: How do you make things that are hard to do as easy as playing a game?

[0.35s pause]

I love this because it's so relatable. We all have those things we know we should do but just...don't. Like going to the gym, or eating healthy.

...

Here's the sample code:
curl -X POST \
    -d '{"text": "The quick brown fox jumps over the lazy dog"}'  \
    -H "Authorization: bearer 7EwR3NF6clC5LV3J5Br4vhlmPieTWz5S"  \
    -H 'Content-Type: application/json'  \
    'https://api.deepinfra.com/v1/inference/hexgrad/Kokoro-82M'


### input field ###
textstring
Text to convert to speech

output_formatstring
Output format for the speech

Default value: "wav"

Allowed values: mp3opusflacwavpcm

preset_voicearray
Preset voice name to use for the speech

Default value: ["af_bella"]

speednumber
Speed of the speech

Range: 0.25 ≤ speed ≤ 4

streamboolean
Whether to stream the output

Default value: false

return_timestampsboolean
Whether to return timestamps

Default value: false

sample_rateinteger
Sample rate for the output audio.

target_min_tokensinteger
Minimum number of tokens for the output.

target_max_tokensinteger
Maximum number of tokens for the output.

absolute_max_tokensinteger
Absolute maximum number of tokens for the output.

webhookfile
The webhook to call when inference is done, by default you will get the output in the response of your inference request

### input schema ###{
    "definitions": {
        "KokoroTtsVoice": {
            "default": "af_bella",
            "description": "Select the desired voice for the speech output. You can select multiple to combine and mix voices.",
            "enum": [
                "af_alloy",
                "af_aoede",
                "af_bella",
                "af_heart",
                "af_jessica",
                "af_kore",
                "af_nicole",
                "af_nova",
                "af_river",
                "af_sarah",
                "af_sky",
                "am_adam",
                "am_echo",
                "am_eric",
                "am_fenrir",
                "am_liam",
                "am_michael",
                "am_onyx",
                "am_puck",
                "am_santa",
                "bf_alice",
                "bf_emma",
                "bf_isabella",
                "bf_lily",
                "bm_daniel",
                "bm_fable",
                "bm_george",
                "bm_lewis",
                "ef_dora",
                "em_alex",
                "em_santa",
                "ff_siwis",
                "hf_alpha",
                "hf_beta",
                "hm_omega",
                "hm_psi",
                "if_sara",
                "im_nicola",
                "jf_alpha",
                "jf_gongitsune",
                "jf_nezumi",
                "jf_tebukuro",
                "jm_kumo",
                "pf_dora",
                "pm_alex",
                "pm_santa",
                "zf_xiaobei",
                "zf_xiaoni",
                "zf_xiaoxiao",
                "zf_xiaoyi",
                "zm_yunjian",
                "zm_yunxi",
                "zm_yunxia",
                "zm_yunyang"
            ],
            "examples": [
                "af_alloy",
                "af_aoede"
            ],
            "title": "KokoroTtsVoice",
            "type": "string"
        },
        "TtsResponseFormat": {
            "default": "wav",
            "description": "Select the desired format for the speech output. Supported formats include mp3, opus, flac, wav, and pcm.",
            "enum": [
                "mp3",
                "opus",
                "flac",
                "wav",
                "pcm"
            ],
            "examples": [
                "mp3",
                "opus",
                "flac",
                "wav",
                "pcm"
            ],
            "title": "TtsResponseFormat",
            "type": "string"
        }
    },
    "required": [
        "text"
    ],
    "title": "KokoroTextToSpeechIn",
    "type": "object",
    "properties": {
        "text": {
            "description": "Text to convert to speech",
            "minLength": 1,
            "title": "Input text",
            "type": "string",
            "example": "The quick brown fox jumps over the lazy dog"
        },
        "output_format": {
            "$ref": "#/definitions/TtsResponseFormat",
            "description": "Output format for the speech",
            "title": "Output format",
            "default": "wav",
            "type": "string"
        },
        "preset_voice": {
            "default": [
                "af_bella"
            ],
            "description": "Preset voice name to use for the speech",
            "items": {
                "$ref": "#/definitions/KokoroTtsVoice"
            },
            "minItems": 1,
            "title": "Preset voice",
            "type": "array"
        },
        "speed": {
            "description": "Speed of the speech",
            "maximum": 4,
            "minimum": 0.25,
            "title": "Speed",
            "type": "number"
        },
        "stream": {
            "default": false,
            "description": "Whether to stream the output",
            "title": "Stream",
            "type": "boolean"
        },
        "return_timestamps": {
            "default": false,
            "description": "Whether to return timestamps",
            "title": "Return Timestamps",
            "type": "boolean"
        },
        "sample_rate": {
            "description": "Sample rate for the output audio.",
            "title": "Sample Rate",
            "type": "integer"
        },
        "target_min_tokens": {
            "description": "Minimum number of tokens for the output.",
            "title": "Target Min Tokens",
            "type": "integer"
        },
        "target_max_tokens": {
            "description": "Maximum number of tokens for the output.",
            "title": "Target Max Tokens",
            "type": "integer"
        },
        "absolute_max_tokens": {
            "description": "Absolute maximum number of tokens for the output.",
            "title": "Absolute Max Tokens",
            "type": "integer"
        },
        "webhook": {
            "description": "The webhook to call when inference is done, by default you will get the output in the response of your inference request",
            "format": "uri",
            "is_base_field": true,
            "maxLength": 2083,
            "minLength": 1,
            "title": "Webhook",
            "type": "string"
        }
    }
}

### output schema ###


