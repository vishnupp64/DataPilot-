from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from app.schemas import (
    MetadataRequest, MetadataResponse,
    PreviewRequest, PreviewResponse,
    AnalysisRequest, AnalysisResponse
)
from app.engine import AnalysisEngine

app = FastAPI(title="DataPilot AI - Python Analysis Service", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health_check():
    return {"status": "ok", "service": "data-analysis-service"}


@app.post("/metadata", response_model=MetadataResponse)
def get_metadata(req: MetadataRequest):
    try:
        return AnalysisEngine.get_metadata(req.file_path)
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/preview", response_model=PreviewResponse)
def get_preview(req: PreviewRequest):
    try:
        return AnalysisEngine.get_preview(req)
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/analyze", response_model=AnalysisResponse)
def run_analysis(req: AnalysisRequest):
    try:
        return AnalysisEngine.execute_analysis(req)
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Analysis error: {str(e)}")
