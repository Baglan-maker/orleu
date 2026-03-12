Перейди в git bash терминал

cd backend

Создай папку венв - python -m venv venv

Активация - source venv/Scripts/activate

Начни с скачивания файла requirements.txt - команда pip install --no-cache-dir --only-binary :all: -r requirements.txt

Запуск uvicorn app.main:app --reload --host 0.0.0.0 --port 8080

FRONETND (папка mobilee):

не менять package.json 

связка с бэкендом: через ipconfig в терминале, найди порт своей сети и подключи его к services/api.ts

