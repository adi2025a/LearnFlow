from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routers import chat, roadmaps, search, study

app = FastAPI(
    title="LearnFlow API",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/health")
async def health_check():
    return {"status": "ok"}


app.include_router(roadmaps.router, prefix="/api")
app.include_router(chat.router, prefix="/api")
app.include_router(search.router, prefix="/api")
app.include_router(study.router, prefix="/api")
