// Global chart references
let userRoleChart = null;
let problemStatusChart = null;

document.addEventListener('DOMContentLoaded', function() {
    // Initialize the dashboard
    initDashboard();
    
    // Set up auto-refresh every 30 seconds
    setInterval(loadDashboardData, 30000);
    
    // Add event listeners
    document.getElementById('refresh-btn').addEventListener('click', loadDashboardData);
});

function initDashboard() {
    loadDashboardData();
    setupEventListeners();
}

function setupEventListeners() {
    // Add any additional event listeners here
}

async function loadDashboardData() {
    try {
        showLoading(true);
        const response = await fetch('/api/dashboard');
        if (!response.ok) throw new Error('Network response was not ok');
        
        const data = await response.json();
        updateDashboard(data);
    } catch (error) {
        console.error('Error loading dashboard data:', error);
        showError('Failed to load dashboard data. Please try again.');
    } finally {
        showLoading(false);
    }
}

function updateDashboard(data) {
    updateStatusCards(data);
    updateCharts(data);
    updateRecentProblems(data.problem_stats.recent_problems);
    updateAvailableTechnicians(data.system_status.available_technicians);
}

function updateStatusCards(data) {
    const cardsContainer = document.getElementById('status-cards');
    cardsContainer.innerHTML = `
        <div class="col-md-3 mb-4">
            <div class="card text-white bg-primary h-100">
                <div class="card-body d-flex flex-column">
                    <h5 class="card-title">Total Users</h5>
                    <p class="card-text display-4 mt-auto">${data.user_stats.total_users}</p>
                    <small class="text-white-50">${data.user_stats.available_users} available</small>
                </div>
            </div>
        </div>
        <div class="col-md-3 mb-4">
            <div class="card text-white bg-success h-100">
                <div class="card-body d-flex flex-column">
                    <h5 class="card-title">Active Problems</h5>
                    <p class="card-text display-4 mt-auto">${data.problem_stats.problems_by_status.progressing || 0}</p>
                    <small class="text-white-50">${data.problem_stats.total_problems} total</small>
                </div>
            </div>
        </div>
        <div class="col-md-3 mb-4">
            <div class="card text-white bg-warning h-100">
                <div class="card-body d-flex flex-column">
                    <h5 class="card-title">Pending Problems</h5>
                    <p class="card-text display-4 mt-auto">${data.problem_stats.problems_by_status.waiting || 0}</p>
                    <small class="text-white-50">${data.problem_stats.problems_by_status.solved || 0} solved</small>
                </div>
            </div>
        </div>
        <div class="col-md-3 mb-4">
            <div class="card text-white ${data.system_status.user_service && data.system_status.problem_service ? 'bg-info' : 'bg-danger'} h-100">
                <div class="card-body d-flex flex-column">
                    <h5 class="card-title">System Status</h5>
                    <div class="mt-auto">
                        <p class="mb-1"><i class="fas ${data.system_status.user_service ? 'fa-check-circle text-success' : 'fa-times-circle text-danger'}"></i> User Service</p>
                        <p class="mb-1"><i class="fas ${data.system_status.problem_service ? 'fa-check-circle text-success' : 'fa-times-circle text-danger'}"></i> Problem Service</p>
                        <p class="mb-1"><i class="fas ${data.system_status.notification_service ? 'fa-check-circle text-success' : 'fa-times-circle text-danger'}"></i> Notification Service</p>
                        <p class="mb-0"><i class="fas ${data.system_status.available_technicians > 0 ? 'fa-check-circle text-success' : 'fa-exclamation-circle text-warning'}"></i> ${data.system_status.available_technicians} Techs Available</p>
                    </div>
                    <small class="text-white-50 mt-2">Last updated: ${new Date().toLocaleTimeString()}</small>
                </div>
            </div>
        </div>
    `;
}

function getSystemStatusText(status) {
    if (!status.user_service && !status.problem_service) return 'All services down';
    if (!status.user_service) return 'User service down';
    if (!status.problem_service) return 'Problem service down';
    return 'All systems operational';
}

function updateCharts(data) {
    updateUserRoleChart(data.user_stats);
    updateProblemStatusChart(data.problem_stats);
}

function updateUserRoleChart(userStats) {
    const ctx = document.getElementById('userRoleChart').getContext('2d');
    
    if (userRoleChart) {
        userRoleChart.destroy();
    }
    
    userRoleChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: Object.keys(userStats.users_by_role),
            datasets: [{
                data: Object.values(userStats.users_by_role),
                backgroundColor: [
                    '#FF6384',
                    '#36A2EB',
                    '#FFCE56',
                    '#4BC0C0',
                    '#9966FF',
                    '#FF9F40'
                ],
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'right',
                },
                title: {
                    display: true,
                    text: 'Users by Role',
                    font: {
                        size: 14
                    }
                }
            },
            cutout: '70%'
        }
    });
}

function updateProblemStatusChart(problemStats) {
    const ctx = document.getElementById('problemStatusChart').getContext('2d');
    
    if (problemStatusChart) {
        problemStatusChart.destroy();
    }
    
    problemStatusChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: Object.keys(problemStats.problems_by_status),
            datasets: [{
                label: 'Problems',
                data: Object.values(problemStats.problems_by_status),
                backgroundColor: [
                    'rgba(255, 159, 64, 0.7)',
                    'rgba(54, 162, 235, 0.7)',
                    'rgba(75, 192, 192, 0.7)'
                ],
                borderColor: [
                    'rgba(255, 159, 64, 1)',
                    'rgba(54, 162, 235, 1)',
                    'rgba(75, 192, 192, 1)'
                ],
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        stepSize: 1
                    }
                }
            },
            plugins: {
                legend: {
                    display: false
                },
                title: {
                    display: true,
                    text: 'Problems by Status',
                    font: {
                        size: 14
                    }
                }
            }
        }
    });
}


function updateAvailableTechnicians(count) {
    const techsContainer = document.getElementById('available-techs');
    techsContainer.innerHTML = count > 0 ? 
        `<span class="badge bg-success">${count} available</span>` :
        `<span class="badge bg-danger">No technicians available</span>`;
}

function truncateText(text, maxLength) {
    return text.length > maxLength ? text.substring(0, maxLength) + '...' : text;
}

function getStatusBadgeClass(status) {
    switch(status.toLowerCase()) {
        case 'waiting': return 'bg-warning text-dark';
        case 'progressing': return 'bg-info text-white';
        case 'solved': return 'bg-success text-white';
        default: return 'bg-secondary text-white';
    }
}

function showLoading(show) {
    const loader = document.getElementById('loading-indicator');
    if (loader) loader.style.display = show ? 'block' : 'none';
}

function showError(message) {
    const alertBox = document.getElementById('error-alert');
    if (alertBox) {
        alertBox.textContent = message;
        alertBox.style.display = 'block';
        setTimeout(() => alertBox.style.display = 'none', 5000);
    }
}

// Global functions for UI actions
window.viewProblemDetails = async function(problemId) {
    try {
        const response = await fetch(`/api/problems/${problemId}`);
        if (!response.ok) throw new Error('Problem not found');
        
        const problem = await response.json();
        showProblemModal(problem);
    } catch (error) {
        console.error('Error loading problem details:', error);
        showError('Failed to load problem details');
    }
};

window.assignProblem = async function(problemId) {
    try {
        // In a real implementation, you would have a technician selection UI
        const response = await fetch(`/api/problems/${problemId}/assign`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ technicianId: 'auto' })
        });
        
        if (!response.ok) throw new Error('Assignment failed');
        
        loadDashboardData();
        showSuccess('Problem assigned successfully');
    } catch (error) {
        console.error('Error assigning problem:', error);
        showError('Failed to assign problem');
    }
};

window.updateProblemStatus = async function(problemId, status) {
    try {
        const response = await fetch(`/api/problems/${problemId}/status`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status })
        });
        
        if (!response.ok) throw new Error('Status update failed');
        
        loadDashboardData();
        showSuccess(`Problem marked as ${status}`);
    } catch (error) {
        console.error('Error updating problem status:', error);
        showError('Failed to update problem status');
    }
};

function showProblemModal(problem) {
    const modal = new bootstrap.Modal(document.getElementById('problemModal'));
    const modalBody = document.getElementById('problem-details');
    
    modalBody.innerHTML = `
        <div class="row">
            <div class="col-md-6">
                <h6>Problem Details</h6>
                <p><strong>ID:</strong> ${problem.id}</p>
                <p><strong>Type:</strong> ${problem.type}</p>
                <p><strong>Status:</strong> <span class="badge ${getStatusBadgeClass(problem.status)}">${problem.status}</span></p>
                <p><strong>Created:</strong> ${new Date(problem.createdAt?.seconds * 1000).toLocaleString()}</p>
            </div>
            <div class="col-md-6">
                <h6>Description</h6>
                <p>${problem.description}</p>
            </div>
        </div>
        <div class="row mt-3">
            <div class="col-12">
                <h6>Assignment</h6>
                <p><strong>Assigned To:</strong> ${problem.assignedTechnician || 'Not assigned'}</p>
                ${problem.assignedTechnician ? `
                <button class="btn btn-sm btn-primary" onclick="notifyTechnician('${problem.assignedTechnician}', '${problem.id}')">
                    <i class="fas fa-bell"></i> Notify Technician
                </button>
                ` : ''}
            </div>
        </div>
    `;
    
    modal.show();
}

function showSuccess(message) {
    const toast = document.getElementById('success-toast');
    if (toast) {
        toast.querySelector('.toast-body').textContent = message;
        bootstrap.Toast.getOrCreateInstance(toast).show();
    }
}

// Initialize any required UI components when the page loads
document.addEventListener('DOMContentLoaded', function() {
    // Initialize tooltips
    const tooltipTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="tooltip"]'));
    tooltipTriggerList.map(function (tooltipTriggerEl) {
        return new bootstrap.Tooltip(tooltipTriggerEl);
    });
});