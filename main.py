from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse
from fastapi.templating import Jinja2Templates
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
import httpx
from typing import Optional, List, Dict
import datetime
import os
import logging
from send_mail import send_email
import asyncio

# Initialize FastAPI app
app = FastAPI(title="Agil Management System", version="1.0.0")

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Set up static files and templates for dashboard
app.mount("/static", StaticFiles(directory="static"), name="static")
templates = Jinja2Templates(directory="templates")

# Configuration for other microservices
USER_SERVICE_URL = "http://localhost:3000"
PROBLEM_SERVICE_URL = "http://localhost:3001"

# Email Models (preserved from your original code)
class EmailRequest(BaseModel):
    to_email: str
    subject: str
    html_content: str

class ProblemNotification(BaseModel):
    to: str
    subject: str
    body: str

# Dashboard Models
class UserStats(BaseModel):
    total_users: int
    users_by_role: Dict[str, int]
    available_users: int
    unavailable_users: int

class ProblemStats(BaseModel):
    total_problems: int
    problems_by_status: Dict[str, int]
    problems_by_type: Dict[str, int]
    recent_problems: List[Dict]
    monthly_comparison: Dict[str, int]

class DashboardData(BaseModel):
    user_stats: UserStats
    problem_stats: ProblemStats
    system_status: Dict[str, bool]

# Helper functions for API calls
async def fetch_users():
    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(f"{USER_SERVICE_URL}/users", timeout=5.0)
            response.raise_for_status()
            return response.json()
    except (httpx.HTTPStatusError, httpx.RequestError) as e:
        raise HTTPException(status_code=502, detail=f"User service unavailable: {str(e)}")

async def fetch_problems():
    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(f"{PROBLEM_SERVICE_URL}/problems", timeout=10.0)
            response.raise_for_status()
            problems = response.json()
            
            # Ensure we always return a list, even if the service returns something else
            if not isinstance(problems, list):
                print(f"Unexpected problems format: {type(problems)}")
                return []
                
            return problems
    except (httpx.HTTPStatusError, httpx.RequestError) as e:
        print(f"Error fetching problems: {str(e)}")
        return []  # Return empty list instead of failing

async def fetch_available_technicians():
    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(f"{USER_SERVICE_URL}/techniciens/available", timeout=5.0)
            response.raise_for_status()
            return response.json()
    except (httpx.HTTPStatusError, httpx.RequestError):
        return []

async def fetch_problem_stats():
    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(f"{PROBLEM_SERVICE_URL}/problems/stats", timeout=5.0)
            response.raise_for_status()
            return response.json()
    except (httpx.HTTPStatusError, httpx.RequestError):
        return {}

async def fetch_recent_problems():
    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(f"{PROBLEM_SERVICE_URL}/problems/recent", timeout=5.0)
            response.raise_for_status()
            return response.json()
    except (httpx.HTTPStatusError, httpx.RequestError):
        return []

# Dashboard endpoints
@app.get("/", response_class=HTMLResponse)
async def dashboard_page(request: Request):
    return templates.TemplateResponse("dashboard.html", {"request": request})
@app.get("/problems", response_class=HTMLResponse)
async def problems_page(request: Request):
    return templates.TemplateResponse("problems.html", {"request": request})
@app.get("/map")
def map_page(request: Request):
    return templates.TemplateResponse("map.html", {"request": request})

@app.get("/api/problems")
async def get_all_problems():
    try:
        problems, users = await asyncio.gather(
            fetch_problems(),
            fetch_users()
        )

        # Build a quick lookup: user_id -> user_name
        user_lookup = {user["id"]: user.get("name", "Unknown User") for user in users}

        validated_problems = []
        for problem in problems:
            if not isinstance(problem, dict):
                continue

            # Resolve names
            chef_name = user_lookup.get(problem.get("chefId"), "Unknown Chef")
            technician_name = user_lookup.get(problem.get("assignedTechnician"), "Unassigned")

            validated_problem = {
                "id": problem.get("id", "unknown"),
                "description": problem.get("description", ""),
                "type": problem.get("type", "unknown"),
                "status": problem.get("status", "unknown"),
                "createdAt": problem.get("createdAt", ""),
                "assignedTechnician": technician_name,
                "priority": problem.get("priority", "normal"),
                "chefId": chef_name
            }
            validated_problems.append(validated_problem)

        return validated_problems
    except Exception as e:
        print(f"Error processing problems: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to fetch problems")

@app.get("/api/dashboard", response_model=DashboardData)
async def get_dashboard_data():
    try:
        # Fetch data from other microservices in parallel
        users, problems, available_techs, problem_stats, recent_problems = await asyncio.gather(
            fetch_users(),
            fetch_problems(),
            fetch_available_technicians(),
            fetch_problem_stats(),
            fetch_recent_problems()
        )

        # Process user statistics
        user_stats = {
            "total_users": len(users),
            "users_by_role": {},
            "available_users": 0,
            "unavailable_users": 0
        }
        
        for user in users:
            role = user.get("role", "unknown")
            user_stats["users_by_role"][role] = user_stats["users_by_role"].get(role, 0) + 1
            if user.get("isAvailable", False):
                user_stats["available_users"] += 1
            else:
                user_stats["unavailable_users"] += 1

        # Process problem statistics
        problem_stats_data = {
            "total_problems": len(problems),
            "problems_by_status": {"waiting": 0, "progressing": 0, "solved": 0},
            "problems_by_type": {},
            "recent_problems": recent_problems,
            "monthly_comparison": problem_stats
        }
        
        for problem in problems:
            status = problem.get("status", "unknown").lower()
            if status in problem_stats_data["problems_by_status"]:
                problem_stats_data["problems_by_status"][status] += 1
            
            problem_type = problem.get("type", "unknown")
            problem_stats_data["problems_by_type"][problem_type] = problem_stats_data["problems_by_type"].get(problem_type, 0) + 1

        # System status
        system_status = {
            "user_service": len(users) > 0,
            "problem_service": len(problems) > 0,
            "notification_service": True,
            "available_technicians": len(available_techs) > 0

        }

        return DashboardData(
            user_stats=UserStats(**user_stats),
            problem_stats=ProblemStats(**problem_stats_data),
            system_status=system_status
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# Preserved email endpoints from your original code
@app.post("/send-email/")
async def send_email_api(email_data: EmailRequest):
    response = await send_email(
        to_email=email_data.to_email,
        subject=email_data.subject,
        html_content=email_data.html_content
    )
    
    if "error" in response:
        error_detail = response["error"]
        if "Unauthorized" in error_detail or "401" in error_detail:
            error_detail += " (Check your SendGrid API key)"
        raise HTTPException(
            status_code=400 if "not configured" in error_detail else 500,
            detail=error_detail
        )
    
    return {"message": "Email sent successfully", "details": response}

@app.post("/notify/email")
async def notify_email(notification: ProblemNotification):
    html_content = f"""
    <html>
        <body>
            <h2>{notification.subject}</h2>
            <p>{notification.body}</p>
            <p>Please check your dashboard for more details.</p>
            <footer>
                <p>This is an automated message - please do not reply directly.</p>
            </footer>
        </body>
    </html>
    """
    
    response = await send_email(
        to_email=notification.to,
        subject=notification.subject,
        html_content=html_content
    )
    
    if "error" in response:
        error_detail = response["error"]
        if "Unauthorized" in error_detail or "401" in error_detail:
            error_detail += " (Check your SendGrid API key)"
        raise HTTPException(
            status_code=400 if "not configured" in error_detail else 500,
            detail=error_detail
        )
    
    return {"message": "Notification email sent successfully", "details": response}

# Health check endpoint
@app.get("/health")
async def health_check():
    services = {
        "user_service": False,
        "problem_service": False,
        "notification_service": True  # Local service
    }
    
    try:
        async with httpx.AsyncClient() as client:
            # Check user service
            try:
                user_response = await client.get(f"{USER_SERVICE_URL}/health", timeout=2.0)
                services["user_service"] = user_response.status_code == 200
            except:
                pass
            
            # Check problem service
            try:
                problem_response = await client.get(f"{PROBLEM_SERVICE_URL}/health", timeout=2.0)
                services["problem_service"] = problem_response.status_code == 200
            except:
                pass
            
            all_healthy = all(services.values())
            
            return {
                "status": "healthy" if all_healthy else "degraded",
                "services": services,
                "timestamp": datetime.datetime.now().isoformat()
            }
    except Exception as e:
        return {
            "status": "unhealthy",
            "services": services,
            "error": str(e),
            "timestamp": datetime.datetime.now().isoformat()
        }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)