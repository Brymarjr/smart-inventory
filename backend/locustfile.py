from locust import HttpUser, task, between

class ForeTrackUser(HttpUser):
    # Simulates a user waiting 1 to 3 seconds between clicks
    wait_time = between(1, 3)
    
    def on_start(self):
        """
        Runs the moment a virtual user spawns. 
        Logs them in using the exact payload defined in the schema.
        """
        # Hits the /api/login/ POST endpoint
        response = self.client.post("/api/login/", json={
            "tenant": "babrite", 
            "username": "olatilewabraimah@gmail.com",
            "password": "Testpass2026"
        })
        
        # If login succeeds, extract the JWT token and set the global headers
        if response.status_code == 200:
            token = response.json().get("access")
            # Injects the Bearer token and X-Tenant header required by your endpoints
            self.headers = {
                "Authorization": f"Bearer {token}", 
                "X-Tenant": "babrite"
            }
        else:
            print(f"Failed to log in: {response.status_code} - {response.text}")
            self.headers = {}

    @task(4)
    def view_dashboard_stats(self):
        """
        Simulates the user landing on the dashboard.
        Weight is 4, meaning this is hit the most frequently.
        """
        self.client.get("/api/sales/dashboard-stats/", headers=self.headers)

    @task(3)
    def view_products(self):
        """Hits the /api/products/ GET endpoint to view inventory."""
        self.client.get("/api/products/", headers=self.headers)

    @task(2)
    def view_sales(self):
        """Hits the /api/sales/ GET endpoint to view transaction history."""
        self.client.get("/api/sales/", headers=self.headers)
        
    @task(1)
    def view_categories(self):
        """Hits the /api/categories/ GET endpoint."""
        self.client.get("/api/categories/", headers=self.headers)