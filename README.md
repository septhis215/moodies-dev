# moodies-dev

# moodies-dev/client/.env 
NEST_API_URL='http://localhost:4000'
NEXT_PUBLIC_TMDB_IMAGE_BASE='https://image.tmdb.org/t/p'

# moodies-dev/server/.env
DATABASE_URL="postgresql://postgres:Admin@123@localhost:5434/moodies-postgres?schema=public"
JWT_SECRET='super-secret'
TMDB_API_KEY=(GET FROM POSTMAN ENVIRONMENT VARIABLES, STAGING API)
PORT=4000