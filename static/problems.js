// Global references
let allProblems = [];


// Add this inside DOMContentLoaded
document.addEventListener('DOMContentLoaded', function() {
    console.log("DOM fully loaded"); // Debug 1
    
    loadProblems();

    // Set up refresh button
    document.getElementById('refresh-btn').addEventListener('click', loadProblems);
    
    // CSV Button setup
    const csvBtn = document.getElementById('download-csv-btn');
    console.log("CSV button element:", csvBtn); // Debug 2
    
    if (csvBtn) {
        csvBtn.addEventListener('click', function() {
            console.log("CSV button clicked!"); // Debug 3
            exportToCSV();
        });
    } else {
        console.error("CSV button not found!");
    }
});
function exportToCSV() {
    if (allProblems.length === 0) {
        alert('No problems to export');
        return;
    }

    // CSV header row
    const headers = [
        'ID', 'Description', 'Type', 'Status', 'Reported By', 
        'Assigned Technician', 'Created At', 'Priority'
    ];
    
    // Process each problem into a CSV row
    const rows = allProblems.map(problem => {
        return [
            problem.id,
            `"${problem.description.replace(/"/g, '""')}"`, // Escape quotes
            problem.type || 'N/A',
            problem.status,
            problem.chefId || 'N/A',
            problem.assignedTechnician || 'Unassigned',
            formatDateForCSV(problem.createdAt),
            problem.priority || 'normal'
        ].join(',');
    });

    // Combine header and rows
    const csvContent = [headers.join(','), ...rows].join('\n');
    
    // Create and trigger download
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `problems_${new Date().toISOString().slice(0,10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

// Special date formatter for CSV (uses ISO format)
function formatDateForCSV(dateField) {
    if (!dateField) return 'N/A';

    // Handle Firestore timestamp format
    if (dateField._seconds !== undefined) {
        return new Date(dateField._seconds * 1000).toISOString();
    }
    if (dateField.seconds !== undefined) {
        return new Date(dateField.seconds * 1000).toISOString();
    }

    // Handle other date formats
    const date = new Date(dateField);
    return isNaN(date) ? 'N/A' : date.toISOString();
}
async function loadProblems() {
    try {
        showLoading(true);
        const response = await fetch('/api/problems');
        
        if (!response.ok) {
            const error = await response.json().catch(() => ({ detail: 'Network error' }));
            throw new Error(error.detail || 'Failed to fetch problems');
        }
        
        const data = await response.json();
        if (!Array.isArray(data)) {
            throw new Error("Invalid data received from server");
        }
        
        // Log raw createdAt values for debugging
        console.log("Raw createdAt values:", data.map(p => p.createdAt));
        
        // Sort problems by createdAt in descending order (newest first)
        const sortedProblems = data.sort((a, b) => {
            const timestampA = getTimestamp(a.createdAt);
            const timestampB = getTimestamp(b.createdAt);
            
            console.log(`Comparing: ${timestampB} (${new Date(timestampB)}) vs ${timestampA} (${new Date(timestampA)})`);
            
            return timestampB - timestampA; // Newest first
        });
        
        allProblems = sortedProblems;
        updateProblemsTable(sortedProblems);
    } catch (error) {
        console.error('Error loading problems:', error);
        showError(error.message || 'Failed to load problems. Please try again.');
    } finally {
        showLoading(false);
    }
}
// Helper function to safely extract and convert Firestore Timestamps
function getTimestamp(createdAt) {
    if (!createdAt) return 0;
    
    // Case 1: Firestore Timestamp format (with or without underscores)
    if (typeof createdAt === 'object') {
        // Handle both _seconds and seconds properties
        const seconds = createdAt._seconds !== undefined ? createdAt._seconds : 
                       createdAt.seconds !== undefined ? createdAt.seconds : null;
        
        if (seconds !== null) {
            return seconds * 1000; // Convert to milliseconds
        }
    }
    
    // Case 2: ISO string format
    if (typeof createdAt === 'string') {
        const date = new Date(createdAt);
        if (!isNaN(date)) {
            return date.getTime();
        }
    }
    
    // Case 3: Direct milliseconds or seconds number
    if (typeof createdAt === 'number') {
        // If it's in seconds (likely Firebase timestamp), convert to milliseconds
        return createdAt > 10000000000 ? createdAt : createdAt * 1000;
    }
    
    console.warn("Unrecognized createdAt format", createdAt);
    return 0; // Fallback value
}


function formatDate(dateField) {
    if (!dateField) return 'N/A';

    // Handle Firestore timestamp format with underscores
    if (dateField._seconds !== undefined) {
        return new Date(dateField._seconds * 1000).toLocaleString();
    }
    
    // Handle regular Firestore timestamp (without underscores)
    if (dateField.seconds !== undefined) {
        return new Date(dateField.seconds * 1000).toLocaleString();
    }

    // Handle ISO string or other date formats
    const date = new Date(dateField);
    if (!isNaN(date)) {
        return date.toLocaleString();
    }

    return 'Invalid Date';
}

function updateProblemsTable(problems) {
    const tbody = document.getElementById('problems-table-body');
    tbody.innerHTML = '';

    problems.forEach(problem => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${problem.id.substring(0, 8)}</td>
            <td>${truncateText(problem.description, 60)}</td>
            <td>${problem.type || 'N/A'}</td>
            <td><span class="badge ${getStatusBadgeClass(problem.status)}">${problem.status}</span></td>
            <td>${problem.chefId ? problem.chefId.substring(0, 8) + '...' : 'N/A'}</td>
            <td>${problem.assignedTechnician ? problem.assignedTechnician.substring(0, 8) + '...' : 'Unassigned'}</td>
            <td>${formatDate(problem.createdAt)}</td>
            <td>
                <button class="btn btn-sm btn-outline-primary" onclick="viewProblemDetails('${problem.id}')">
                    <i class="fas fa-eye"></i> View
                </button>
                ${problem.status === 'waiting' ? ` 
                <button class="btn btn-sm btn-outline-warning" onclick="assignProblem('${problem.id}')">
                    <i class="fas fa-user-plus"></i> Assign
                </button>
                ` : ''}
                ${problem.status === 'progressing' ? `
                <button class="btn btn-sm btn-outline-success" onclick="updateProblemStatus('${problem.id}', 'solved')">
                    <i class="fas fa-check"></i> Solve
                </button>
                ` : ''}
            </td>
        `;
        tbody.appendChild(row);
    });
}

// Helper functions
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
    alert(message); // Simple alert for now, you can replace with a better UI
}

// Global functions for UI actions
window.viewProblemDetails = async function(problemId) {
    try {
        const problem = allProblems.find(p => p.id === problemId);
        if (problem) {
            showProblemModal(problem);
        } else {
            const response = await fetch(`/api/problems/${problemId}`);
            if (!response.ok) throw new Error('Problem not found');
            const problem = await response.json();
            showProblemModal(problem);
        }
    } catch (error) {
        console.error('Error loading problem details:', error);
        showError('Failed to load problem details');
    }
};

window.assignProblem = async function(problemId) {
    try {
        if (!confirm('Assign this problem to an available technician?')) return;

        const response = await fetch(`/api/problems/${problemId}/assign`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
        });

        if (!response.ok) throw new Error('Assignment failed');

        loadProblems();
        alert('Problem assigned successfully');
    } catch (error) {
        console.error('Error assigning problem:', error);
        showError('Failed to assign problem');
    }
};

window.updateProblemStatus = async function(problemId, status) {
    try {
        if (!confirm(`Mark this problem as ${status}?`)) return;

        const response = await fetch(`/api/problems/${problemId}/status`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status })
        });

        if (!response.ok) throw new Error('Status update failed');

        loadProblems();
        alert(`Problem marked as ${status}`);
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
                <p><strong>Type:</strong> ${problem.type || 'N/A'}</p>
                <p><strong>Status:</strong> <span class="badge ${getStatusBadgeClass(problem.status)}">${problem.status}</span></p>
                <p><strong>Created:</strong> ${formatDate(problem.createdAt)}</p>
                <p><strong>Priority:</strong> ${problem.priority || 'Normal'}</p>
                <p><strong>Reported by Chef:</strong> ${problem.chefId || 'N/A'}</p>
            </div>
            <div class="col-md-6">
                <h6>Assignment</h6>
                <p><strong>Assigned To:</strong> ${problem.assignedTechnician || 'Not assigned'}</p>
                <p><strong>Assigned At:</strong> ${problem.assignedAt ? new Date(problem.assignedAt?.seconds * 1000).toLocaleString() : 'N/A'}</p>
                ${problem.assignedTechnician ? `
                <button class="btn btn-sm btn-primary" onclick="notifyTechnician('${problem.assignedTechnician}', '${problem.id}')">
                    <i class="fas fa-bell"></i> Notify Technician
                </button>
                ` : ''}
            </div>
        </div>
        <div class="row mt-3">
            <div class="col-12">
                <h6>Description</h6>
                <div class="card">
                    <div class="card-body">
                        ${problem.description || 'No description provided'}
                    </div>
                </div>
            </div>
        </div>
        ${problem.solution ? `
        <div class="row mt-3">
            <div class="col-12">
                <h6>Solution</h6>
                <div class="card">
                    <div class="card-body">
                        ${problem.solution}
                    </div>
                </div>
            </div>
        </div>
        ` : ''}
    `;
    
    modal.show();
}
