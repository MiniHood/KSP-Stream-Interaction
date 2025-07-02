# KSP-Stream-Interaction
A mod for stream interaction using kOS

Super buggy mess made mostly with AI, still a cool proof of concept. Use KOS module and enable telenet on kOS on 127.0.0.1 at port 5410, link your twitch account. Will most likely get stuck in a boot loop if the module detatches you. Enjoy

# Requirements
- https://github.com/KSP-KOS/KOS

### Getting Your OAuth Token

1. Go to [Twitch Chat OAuth Password Generator](https://twitchtokengenerator.com/)
2. Log in with your Twitch account
3. Copy the generated OAuth token
4. Use this token in your configuration

5. #### TCP Endpoints
- `POST /api/send` - Send message via TCP
- `GET /api/status` - Get TCP connection status
- `POST /api/reconnect` - Reconnect TCP
