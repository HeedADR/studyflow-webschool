from flask import Flask, request, jsonify, send_from_directory, session
from flask_cors import CORS
import sqlite3
import os
from datetime import datetime, timedelta, date
import hashlib
import secrets
import json

app = Flask(__name__)
app.secret_key = secrets.token_hex(16)
CORS(app, supports_credentials=True)  # Habilita CORS para permitir requisições do frontend

def get_db_connection():
    """Conecta ao banco de dados SQLite"""
    conn = sqlite3.connect('studyflow.db')
    conn.row_factory = sqlite3.Row  # Para retornar dicionários
    return conn

def init_db():
    conn = get_db_connection()
    
    # Criar tabela de usuários
    conn.execute('''
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            full_name TEXT NOT NULL,
            role TEXT DEFAULT 'user',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    
    # Criar tabela de disciplinas
    conn.execute('''
        CREATE TABLE IF NOT EXISTS subjects (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            name TEXT NOT NULL,
            color TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users (id)
        )
    ''')
    
    # Criar tabela de sessões de estudo
    conn.execute('''
        CREATE TABLE IF NOT EXISTS study_sessions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            subject_id INTEGER NOT NULL,
            duration_minutes INTEGER NOT NULL,
            date DATE NOT NULL,
            start_time TIME,
            end_time TIME,
            notes TEXT,
            technique TEXT DEFAULT 'pomodoro',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users (id),
            FOREIGN KEY (subject_id) REFERENCES subjects (id)
        )
    ''')
    
    # Criar tabela de agenda/cronograma
    conn.execute('''
        CREATE TABLE IF NOT EXISTS schedule (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            subject_id INTEGER NOT NULL,
            title TEXT NOT NULL,
            date DATE NOT NULL,
            time TIME NOT NULL,
            duration_minutes INTEGER NOT NULL,
            completed BOOLEAN DEFAULT FALSE,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users (id),
            FOREIGN KEY (subject_id) REFERENCES subjects (id)
        )
    ''')
    
    # Criar tabela de anotações
    conn.execute('''
        CREATE TABLE IF NOT EXISTS notes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            subject_id INTEGER NOT NULL,
            title TEXT NOT NULL,
            content TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users (id),
            FOREIGN KEY (subject_id) REFERENCES subjects (id)
        )
    ''')
    
    conn.commit()
    conn.close()

def hash_password(password):
    return hashlib.sha256(password.encode()).hexdigest()

def verify_password(password, password_hash):
    return hashlib.sha256(password.encode()).hexdigest() == password_hash

def require_auth():
    if 'user_id' not in session:
        return jsonify({'error': 'Authentication required'}), 401
    return None

@app.route('/api/login', methods=['POST'])
def login():
    data = request.get_json()
    username = data.get('username')
    password = data.get('password')
    
    if not username or not password:
        return jsonify({'error': 'Username and password required'}), 400
    
    conn = get_db_connection()
    user = conn.execute(
        'SELECT id, username, password_hash, full_name, role FROM users WHERE username = ?',
        (username,)
    ).fetchone()
    conn.close()
    
    if user and verify_password(password, user['password_hash']):
        session['user_id'] = user['id']
        session['username'] = user['username']
        session['full_name'] = user['full_name']
        session['role'] = user['role']
        return jsonify({
            'success': True,
            'user': {
                'id': user['id'],
                'username': user['username'],
                'full_name': user['full_name'],
                'role': user['role']
            }
        })
    else:
        return jsonify({'error': 'Invalid credentials'}), 401

@app.route('/api/logout', methods=['POST'])
def logout():
    session.clear()
    return jsonify({'success': True})

@app.route('/api/current-user', methods=['GET'])
def current_user():
    if 'user_id' in session:
        return jsonify({
            'user': {
                'id': session['user_id'],
                'username': session['username'],
                'full_name': session['full_name'],
                'role': session['role']
            }
        })
    else:
        return jsonify({'user': None})

@app.route('/')
def serve_frontend():
    """Serve o arquivo HTML principal"""
    return send_from_directory('.', 'index.html')

@app.route('/<path:path>')
def serve_static_files(path):
    """Serve arquivos estáticos (CSS, JS, etc.)"""
    return send_from_directory('.', path)

# === ROTAS PARA DISCIPLINAS ===

@app.route('/api/subjects', methods=['GET'])
def get_subjects():
    """Retorna todas as disciplinas"""
    auth_error = require_auth()
    if auth_error:
        return auth_error
    
    conn = get_db_connection()
    subjects = conn.execute(
        'SELECT * FROM subjects WHERE user_id = ? ORDER BY name',
        (session['user_id'],)
    ).fetchall()
    conn.close()
    return jsonify([dict(subject) for subject in subjects])

@app.route('/api/subjects', methods=['POST'])
def create_subject():
    """Cria uma nova disciplina"""
    auth_error = require_auth()
    if auth_error:
        return auth_error
    
    data = request.get_json()
    name = data.get('name')
    color = data.get('color', '#4A90E2')

    if not name:
        return jsonify({'error': 'Nome da disciplina é obrigatório'}), 400

    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute('INSERT INTO subjects (user_id, name, color) VALUES (?, ?, ?)', (session['user_id'], name, color))
    subject_id = cursor.lastrowid
    conn.commit()
    conn.close()

    return jsonify({'id': subject_id, 'name': name, 'color': color}), 201

# === ROTAS PARA SESSÕES DE ESTUDO ===

@app.route('/api/study-sessions', methods=['GET'])
def get_study_sessions():
    """Retorna sessões de estudo com filtros opcionais"""
    auth_error = require_auth()
    if auth_error:
        return auth_error
    
    start_date = request.args.get('start_date')
    end_date = request.args.get('end_date')
    subject_id = request.args.get('subject_id')

    query = '''
        SELECT s.*, sub.name as subject_name, sub.color as subject_color 
        FROM study_sessions s 
        LEFT JOIN subjects sub ON s.subject_id = sub.id 
        WHERE s.user_id = ?
    '''
    params = [session['user_id']]

    if start_date:
        query += ' AND s.date >= ?'
        params.append(start_date)

    if end_date:
        query += ' AND s.date <= ?'
        params.append(end_date)

    if subject_id:
        query += ' AND s.subject_id = ?'
        params.append(subject_id)

    query += ' ORDER BY s.date DESC, s.start_time DESC'

    conn = get_db_connection()
    sessions = conn.execute(query, params).fetchall()
    conn.close()

    return jsonify([dict(session) for session in sessions])

@app.route('/api/study-sessions', methods=['POST'])
def create_study_session():
    """Cria uma nova sessão de estudo"""
    auth_error = require_auth()
    if auth_error:
        return auth_error
    
    data = request.get_json()

    required_fields = ['subject_id', 'duration_minutes', 'date']
    for field in required_fields:
        if field not in data:
            return jsonify({'error': f'Campo {field} é obrigatório'}), 400

    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute('''
        INSERT INTO study_sessions (user_id, subject_id, duration_minutes, date, start_time, end_time, notes, technique)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ''', (
        session['user_id'],
        data['subject_id'],
        data['duration_minutes'], 
        data['date'],
        data.get('start_time'),
        data.get('end_time'),
        data.get('notes', ''),
        data.get('technique', 'pomodoro')
    ))

    session_id = cursor.lastrowid
    conn.commit()
    conn.close()

    return jsonify({'id': session_id, 'message': 'Sessão de estudo criada com sucesso'}), 201

# === ROTAS PARA AGENDA/PLANEJAMENTO ===

@app.route('/api/schedule', methods=['GET'])
def get_schedule():
    """Retorna itens da agenda"""
    auth_error = require_auth()
    if auth_error:
        return auth_error
    
    date_filter = request.args.get('date')
    week_start = request.args.get('week_start')

    query = '''
        SELECT sch.*, sub.name as subject_name, sub.color as subject_color
        FROM schedule sch
        LEFT JOIN subjects sub ON sch.subject_id = sub.id
        WHERE sch.user_id = ?
    '''
    params = [session['user_id']]

    if date_filter:
        query += ' AND sch.date = ?'
        params.append(date_filter)

    if week_start:
        query += ' AND sch.date >= date(?) AND sch.date < date(?, "+7 days")'
        params.extend([week_start, week_start])

    query += ' ORDER BY sch.date, sch.time'

    conn = get_db_connection()
    schedule_items = conn.execute(query, params).fetchall()
    conn.close()

    return jsonify([dict(item) for item in schedule_items])

@app.route('/api/schedule', methods=['POST'])
def create_schedule_item():
    """Cria um novo item na agenda"""
    auth_error = require_auth()
    if auth_error:
        return auth_error
    
    data = request.get_json()

    required_fields = ['subject_id', 'title', 'date', 'time', 'duration_minutes']
    for field in required_fields:
        if field not in data:
            return jsonify({'error': f'Campo {field} é obrigatório'}), 400

    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute('''
        INSERT INTO schedule (user_id, subject_id, title, date, time, duration_minutes)
        VALUES (?, ?, ?, ?, ?, ?)
    ''', (
        session['user_id'],
        data['subject_id'],
        data['title'],
        data['date'],
        data['time'],
        data['duration_minutes']
    ))

    schedule_id = cursor.lastrowid
    conn.commit()
    conn.close()

    return jsonify({'id': schedule_id, 'message': 'Item agendado com sucesso'}), 201

@app.route('/api/schedule/<int:schedule_id>', methods=['PUT'])
def update_schedule_status(schedule_id):
    """Atualiza o status de um item da agenda"""
    data = request.get_json()
    status = data.get('status', 'completed')

    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute('UPDATE schedule SET status = ? WHERE id = ?', (status, schedule_id))
    conn.commit()
    conn.close()

    return jsonify({'message': 'Status atualizado com sucesso'})

# === ROTAS PARA ANOTAÇÕES ===

@app.route('/api/notes', methods=['GET'])
def get_notes():
    """Retorna anotações"""
    auth_error = require_auth()
    if auth_error:
        return auth_error
    
    subject_id = request.args.get('subject_id')

    query = '''
        SELECT n.*, sub.name as subject_name, sub.color as subject_color
        FROM notes n
        LEFT JOIN subjects sub ON n.subject_id = sub.id
        WHERE n.user_id = ?
    '''
    params = [session['user_id']]

    if subject_id:
        query += ' AND n.subject_id = ?'
        params.append(subject_id)

    query += ' ORDER BY n.updated_at DESC'

    conn = get_db_connection()
    notes = conn.execute(query, params).fetchall()
    conn.close()

    return jsonify([dict(note) for note in notes])

@app.route('/api/notes', methods=['POST'])
def create_note():
    """Cria uma nova anotação"""
    auth_error = require_auth()
    if auth_error:
        return auth_error
    
    data = request.get_json()

    required_fields = ['subject_id', 'title', 'content']
    for field in required_fields:
        if field not in data:
            return jsonify({'error': f'Campo {field} é obrigatório'}), 400

    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute('''
        INSERT INTO notes (user_id, subject_id, title, content)
        VALUES (?, ?, ?, ?)
    ''', (session['user_id'], data['subject_id'], data['title'], data['content']))

    note_id = cursor.lastrowid
    conn.commit()
    conn.close()

    return jsonify({'id': note_id, 'message': 'Anotação criada com sucesso'}), 201

# === ROTAS PARA RELATÓRIOS E ESTATÍSTICAS ===

@app.route('/api/stats/weekly', methods=['GET'])
def get_weekly_stats():
    """Retorna estatísticas semanais"""
    week_start = request.args.get('week_start', date.today().strftime('%Y-%m-%d'))

    conn = get_db_connection()

    # Total de horas estudadas na semana
    total_query = '''
        SELECT SUM(duration_minutes) as total_minutes
        FROM study_sessions 
        WHERE date >= date(?) AND date < date(?, "+7 days")
    '''

    total_result = conn.execute(total_query, (week_start, week_start)).fetchone()
    total_hours = (total_result['total_minutes'] or 0) / 60

    # Horas por disciplina
    by_subject_query = '''
        SELECT s.name, s.color, SUM(ss.duration_minutes) as total_minutes
        FROM study_sessions ss
        JOIN subjects s ON ss.subject_id = s.id
        WHERE ss.date >= date(?) AND ss.date < date(?, "+7 days")
        GROUP BY ss.subject_id, s.name, s.color
        ORDER BY total_minutes DESC
    '''

    by_subject = conn.execute(by_subject_query, (week_start, week_start)).fetchall()

    # Sessões por dia da semana
    daily_query = '''
        SELECT date, SUM(duration_minutes) as total_minutes, COUNT(*) as session_count
        FROM study_sessions
        WHERE date >= date(?) AND date < date(?, "+7 days")
        GROUP BY date
        ORDER BY date
    '''

    daily = conn.execute(daily_query, (week_start, week_start)).fetchall()

    conn.close()

    return jsonify({
        'total_hours': round(total_hours, 2),
        'by_subject': [dict(row) for row in by_subject],
        'daily': [dict(row) for row in daily]
    })

# === ROTA PARA TIMER POMODORO ===

@app.route('/api/timer/pomodoro', methods=['POST'])
def save_pomodoro_session():
    """Salva uma sessão de pomodoro completada"""
    data = request.get_json()

    # Cria automaticamente uma sessão de estudo baseada no pomodoro
    duration_minutes = data.get('duration_minutes', 25)  # Padrão: 25 minutos

    session_data = {
        'subject_id': data.get('subject_id'),
        'duration_minutes': duration_minutes,
        'date': date.today().strftime('%Y-%m-%d'),
        'start_time': data.get('start_time'),
        'end_time': data.get('end_time'),
        'technique': 'pomodoro',
        'notes': f"Sessão Pomodoro - {duration_minutes} minutos"
    }

    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute('''
        INSERT INTO study_sessions (subject_id, duration_minutes, date, start_time, end_time, notes, technique)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    ''', (
        session_data['subject_id'],
        session_data['duration_minutes'], 
        session_data['date'],
        session_data['start_time'],
        session_data['end_time'],
        session_data['notes'],
        session_data['technique']
    ))

    session_id = cursor.lastrowid
    conn.commit()
    conn.close()

    return jsonify({'id': session_id, 'message': 'Sessão Pomodoro salva com sucesso'}), 201

def require_admin():
    """Decorator para verificar se o usuário é admin"""
    def decorator(f):
        def wrapper(*args, **kwargs):
            if 'user_id' not in session:
                return jsonify({'error': 'Authentication required'}), 401
            if session.get('role') != 'admin':
                return jsonify({'error': 'Admin access required'}), 403
            return f(*args, **kwargs)
        wrapper.__name__ = f.__name__
        return wrapper
    return decorator

# Endpoints de administração de usuários
@app.route('/api/admin/users', methods=['GET'])
def get_all_users():
    """Listar todos os usuários (apenas admin)"""
    if 'user_id' not in session:
        return jsonify({'error': 'Authentication required'}), 401
    if session.get('role') != 'admin':
        return jsonify({'error': 'Admin access required'}), 403
    
    conn = get_db_connection()
    users = conn.execute(
        'SELECT id, username, full_name, role, created_at FROM users ORDER BY created_at DESC'
    ).fetchall()
    conn.close()
    
    return jsonify([dict(user) for user in users])

@app.route('/api/admin/users', methods=['POST'])
def create_user():
    """Criar novo usuário (apenas admin)"""
    if 'user_id' not in session:
        return jsonify({'error': 'Authentication required'}), 401
    if session.get('role') != 'admin':
        return jsonify({'error': 'Admin access required'}), 403
    
    data = request.get_json()
    username = data.get('username')
    password = data.get('password')
    full_name = data.get('full_name')
    role = data.get('role', 'user')
    
    if not username or not password or not full_name:
        return jsonify({'error': 'Username, password and full_name are required'}), 400
    
    if role not in ['user', 'admin']:
        return jsonify({'error': 'Role must be user or admin'}), 400
    
    conn = get_db_connection()
    
    # Verificar se o username já existe
    existing_user = conn.execute(
        'SELECT id FROM users WHERE username = ?', (username,)
    ).fetchone()
    
    if existing_user:
        conn.close()
        return jsonify({'error': 'Username already exists'}), 400
    
    # Criar novo usuário
    password_hash = hash_password(password)
    cursor = conn.cursor()
    cursor.execute(
        'INSERT INTO users (username, password_hash, full_name, role) VALUES (?, ?, ?, ?)',
        (username, password_hash, full_name, role)
    )
    
    user_id = cursor.lastrowid
    conn.commit()
    conn.close()
    
    return jsonify({
        'id': user_id,
        'username': username,
        'full_name': full_name,
        'role': role,
        'message': 'User created successfully'
    }), 201

@app.route('/api/admin/users/<int:user_id>', methods=['PUT'])
def update_user(user_id):
    """Atualizar usuário (apenas admin)"""
    if 'user_id' not in session:
        return jsonify({'error': 'Authentication required'}), 401
    if session.get('role') != 'admin':
        return jsonify({'error': 'Admin access required'}), 403
    
    data = request.get_json()
    username = data.get('username')
    full_name = data.get('full_name')
    role = data.get('role')
    password = data.get('password')  # Opcional
    
    if not username or not full_name or not role:
        return jsonify({'error': 'Username, full_name and role are required'}), 400
    
    if role not in ['user', 'admin']:
        return jsonify({'error': 'Role must be user or admin'}), 400
    
    conn = get_db_connection()
    
    # Verificar se o usuário existe
    existing_user = conn.execute(
        'SELECT id FROM users WHERE id = ?', (user_id,)
    ).fetchone()
    
    if not existing_user:
        conn.close()
        return jsonify({'error': 'User not found'}), 404
    
    # Verificar se o username já existe em outro usuário
    username_check = conn.execute(
        'SELECT id FROM users WHERE username = ? AND id != ?', (username, user_id)
    ).fetchone()
    
    if username_check:
        conn.close()
        return jsonify({'error': 'Username already exists'}), 400
    
    # Atualizar usuário
    if password:
        password_hash = hash_password(password)
        conn.execute(
            'UPDATE users SET username = ?, full_name = ?, role = ?, password_hash = ? WHERE id = ?',
            (username, full_name, role, password_hash, user_id)
        )
    else:
        conn.execute(
            'UPDATE users SET username = ?, full_name = ?, role = ? WHERE id = ?',
            (username, full_name, role, user_id)
        )
    
    conn.commit()
    conn.close()
    
    return jsonify({
        'id': user_id,
        'username': username,
        'full_name': full_name,
        'role': role,
        'message': 'User updated successfully'
    })

@app.route('/api/admin/users/<int:user_id>', methods=['DELETE'])
def delete_user(user_id):
    """Excluir usuário (apenas admin)"""
    if 'user_id' not in session:
        return jsonify({'error': 'Authentication required'}), 401
    if session.get('role') != 'admin':
        return jsonify({'error': 'Admin access required'}), 403
    
    # Não permitir que o admin exclua a si mesmo
    if user_id == session['user_id']:
        return jsonify({'error': 'Cannot delete your own account'}), 400
    
    conn = get_db_connection()
    
    # Verificar se o usuário existe
    existing_user = conn.execute(
        'SELECT id FROM users WHERE id = ?', (user_id,)
    ).fetchone()
    
    if not existing_user:
        conn.close()
        return jsonify({'error': 'User not found'}), 404
    
    # Excluir dados relacionados ao usuário
    conn.execute('DELETE FROM study_sessions WHERE subject_id IN (SELECT id FROM subjects WHERE user_id = ?)', (user_id,))
    conn.execute('DELETE FROM schedule WHERE user_id = ?', (user_id,))
    conn.execute('DELETE FROM notes WHERE user_id = ?', (user_id,))
    conn.execute('DELETE FROM subjects WHERE user_id = ?', (user_id,))
    conn.execute('DELETE FROM users WHERE id = ?', (user_id,))
    
    conn.commit()
    conn.close()
    
    return jsonify({'message': 'User deleted successfully'})

def create_default_users():
    """Cria usuários padrão se não existirem"""
    conn = get_db_connection()
    
    # Verificar se já existem usuários
    existing_users = conn.execute('SELECT COUNT(*) as count FROM users').fetchone()
    
    if existing_users['count'] == 0:
        # Criar usuário admin
        admin_password = hash_password('admin123')
        conn.execute(
            'INSERT INTO users (username, password_hash, full_name, role) VALUES (?, ?, ?, ?)',
            ('admin', admin_password, 'Administrador', 'admin')
        )
        
        # Criar usuário Lucas Mendes
        lucas_password = hash_password('lucas123')
        conn.execute(
            'INSERT INTO users (username, password_hash, full_name, role) VALUES (?, ?, ?, ?)',
            ('lucas.mendes', lucas_password, 'Lucas Mendes', 'user')
        )
        
        # Criar usuário Ana Beatriz
        ana_password = hash_password('ana123')
        conn.execute(
            'INSERT INTO users (username, password_hash, full_name, role) VALUES (?, ?, ?, ?)',
            ('ana.beatriz', ana_password, 'Ana Beatriz', 'user')
        )
        
        conn.commit()
        print('Usuários padrão criados:')
        print('- admin / admin123')
        print('- lucas.mendes / lucas123')
        print('- ana.beatriz / ana123')
    
    conn.close()

if __name__ == '__main__':
    init_db()
    create_default_users()
    app.run(debug=True)
