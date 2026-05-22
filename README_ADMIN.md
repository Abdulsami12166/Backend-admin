# backend-admin

Admin-only backend server for the Ecommerce app.

## Run
1. Create/adjust environment variables in `backend-admin/.env`.
2. Start:
   ```bash
   cd backend-admin
   npm install
   npm run start
   ```

## Base URL
- Health: `GET /api/v1/health`
- Admin API: `GET/PATCH/POST/DELETE /api/v1/admin/*`

## Admin endpoints
- Dashboard metrics: `GET /api/v1/admin/dashboard/metrics`
- Products:
  - `GET /api/v1/admin/products`
  - `POST /api/v1/admin/products`
  - `PUT /api/v1/admin/products/:id`
  - `DELETE /api/v1/admin/products/:id`
- Orders:
  - `GET /api/v1/admin/orders`
  - `PATCH /api/v1/admin/orders/:id/status`
  - `DELETE /api/v1/admin/orders/:id`
- Users:
  - `GET /api/v1/admin/users`
  - `DELETE /api/v1/admin/users/:id`
  - `POST /api/v1/admin/users/:id/block`
  - `POST /api/v1/admin/users/:id/unblock`

