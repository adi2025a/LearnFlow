import json
import logging
import re
from urllib.parse import quote

import httpx

from app.schemas import YouTubeSearchResult

logger = logging.getLogger(__name__)

USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
    "AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/124.0.0.0 Safari/537.36"
)


async def search_youtube(query: str, limit: int = 12) -> list[YouTubeSearchResult]:
    encoded_query = quote(query)
    url = f"https://www.youtube.com/results?search_query={encoded_query}"
    headers = {
        "User-Agent": USER_AGENT,
        "Accept-Language": "en-US,en;q=0.9",
    }

    try:
        async with httpx.AsyncClient(timeout=6.0, follow_redirects=True) as client:
            response = await client.get(url, headers=headers)
            if response.status_code != 200:
                logger.warning(
                    "YouTube returned status %s for query %s",
                    response.status_code,
                    query,
                )
                return []

            html = response.text

            # 1. Primary Strategy: parse ytInitialData JSON
            match = re.search(r"var ytInitialData = ({.*?});</script>", html)
            if match:
                try:
                    data = json.loads(match.group(1))
                    section_contents = (
                        data.get("contents", {})
                        .get("twoColumnSearchResultsRenderer", {})
                        .get("primaryContents", {})
                        .get("sectionListRenderer", {})
                        .get("contents", [])
                    )

                    videos: list[YouTubeSearchResult] = []
                    for section in section_contents:
                        items = section.get("itemSectionRenderer", {}).get(
                            "contents", []
                        )
                        for item in items:
                            if "videoRenderer" in item:
                                vr = item["videoRenderer"]
                                vid = vr.get("videoId")
                                if not vid or len(vid) != 11:
                                    continue

                                # Title
                                title_runs = vr.get("title", {}).get("runs", [])
                                title = (
                                    title_runs[0].get("text", "") if title_runs else ""
                                )

                                # Channel
                                owner_runs = vr.get("ownerText", {}).get("runs", [])
                                channel = (
                                    owner_runs[0].get("text", "") if owner_runs else ""
                                )

                                # Duration
                                duration = vr.get("lengthText", {}).get(
                                    "simpleText", None
                                )

                                # Thumbnail
                                thumb = f"https://i.ytimg.com/vi/{vid}/hqdefault.jpg"

                                if title:
                                    videos.append(
                                        YouTubeSearchResult(
                                            id=vid,
                                            title=title,
                                            channel=channel,
                                            thumbnail=thumb,
                                            duration=duration,
                                        )
                                    )
                                    if len(videos) >= limit:
                                        return videos

                    if videos:
                        return videos
                except Exception as parse_err:  # noqa: BLE001
                    logger.debug("Failed parsing ytInitialData: %s", parse_err)

            # 2. Fallback: regex search on HTML
            videos = []
            seen_ids = set()
            pattern = re.compile(
                r'"videoId":"([a-zA-Z0-9_-]{11})".*?"title":{"runs":\[{"text":"(.*?)"}\]}[^}]*"ownerText":{"runs":\[{"text":"(.*?)"}\]'
            )
            for vid, title, channel in pattern.findall(html):
                if vid not in seen_ids:
                    seen_ids.add(vid)
                    videos.append(
                        YouTubeSearchResult(
                            id=vid,
                            title=title,
                            channel=channel,
                            thumbnail=f"https://i.ytimg.com/vi/{vid}/hqdefault.jpg",
                        )
                    )
                    if len(videos) >= limit:
                        break

            return videos

    except Exception as exc:  # noqa: BLE001
        logger.warning("YouTube search request failed: %s", exc)
        return []
