from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(
    title="Data Migration Tool API",
    description="Python API for calculations and AI processing for the Data Migration Tool",
    version="1.0.0"
)

# Enable CORS for Next.js frontend calls
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
def read_root():
    return {"message": "Welcome to the Data Migration Tool Backend API!"}

@app.get("/api/health")
def health_check():
    return {"status": "healthy", "service": "data-migration-api"}
