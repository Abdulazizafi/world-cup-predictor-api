@echo off
echo.
echo ============================================================
echo  2026 World Cup Predictor API - Full E2E Test
echo ============================================================
echo.

set BASE=http://localhost:3000

echo [1] Health Check
curl -s %BASE%/health
echo.

echo [2] Register user "alex_test"
curl -s -X POST %BASE%/api/auth/register ^
  -H "Content-Type: application/json" ^
  -d "{\"username\":\"alex_test\",\"password\":\"pass1234\"}" ^
  -c cookies.txt
echo.

echo [3] Login as "alex_test"
curl -s -X POST %BASE%/api/auth/login ^
  -H "Content-Type: application/json" ^
  -d "{\"username\":\"alex_test\",\"password\":\"pass1234\"}" ^
  -c cookies.txt
echo.

echo [4] GET /api/auth/me
curl -s %BASE%/api/auth/me ^
  -b cookies.txt
echo.

echo [5] Create group "World Cup Finals League"
curl -s -X POST %BASE%/api/groups/create ^
  -H "Content-Type: application/json" ^
  -d "{\"name\":\"World Cup Finals League\"}" ^
  -b cookies.txt ^
  -c cookies.txt
echo.

echo [6] GET /api/auth/me (should now have groupId)
curl -s %BASE%/api/auth/me ^
  -b cookies.txt
echo.

echo [7] GET /api/matches
curl -s %BASE%/api/matches ^
  -b cookies.txt
echo.

echo [8] Validation test - invalid register (short password)
curl -s -X POST %BASE%/api/auth/register ^
  -H "Content-Type: application/json" ^
  -d "{\"username\":\"x\",\"password\":\"123\"}"
echo.

echo [9] Duplicate username test
curl -s -X POST %BASE%/api/auth/register ^
  -H "Content-Type: application/json" ^
  -d "{\"username\":\"alex_test\",\"password\":\"pass1234\"}"
echo.

echo [10] Invalid invite code test
curl -s -X POST %BASE%/api/groups/join ^
  -H "Content-Type: application/json" ^
  -d "{\"inviteCode\":\"XXXXXX\"}" ^
  -b cookies.txt
echo.

echo [11] Logout
curl -s -X POST %BASE%/api/auth/logout ^
  -b cookies.txt ^
  -c cookies.txt
echo.

echo [12] GET /api/auth/me after logout (should be 401)
curl -s %BASE%/api/auth/me ^
  -b cookies.txt
echo.

echo.
echo ============================================================
echo  Test complete
echo ============================================================

del cookies.txt 2>nul
