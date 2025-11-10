from flask import Flask, render_template, request, jsonify
import mysql.connector

app = Flask(__name__)

db = mysql.connector.connect(
    host="localhost",
    user="root",
    password="Krmk@1999",
    database="CRIME1"
)
cursor = db.cursor()
table_primary_keys = {
        'Officer': 'Officer_ID',
        'Case_File': 'File_ID',
        'Crime_Scene': 'Scene_ID',
        'Victim': 'Victim_SSN',
        'Witness': 'Witness_SSN',
        'Suspect': 'Suspect_SSN',
        'Evidence': 'Evidence_ID',
        'Forensic_Report': 'Report_ID',
        'Family': 'Relative_ID'
    }

foreign_keys = {
        'Officer': 'Supervisor_ID',
        'Case_File': 'Officer_ID',
        'Crime_Scene': 'File_ID',
        'Victim': 'Scene_ID',
        'Witness': 'Scene_ID',
        'Suspect': 'Scene_ID',
        'Evidence': 'Scene_ID',
        'Forensic_Report': ['Officer_ID', 'Evidence_ID'],
        'Family': ['Suspect_SSN', 'Victim_SSN']
    }


@app.route('/')
def home():
    cursor.execute("SHOW TABLES")
    tables = [table[0] for table in cursor.fetchall()]
    return render_template('index.html', tables=tables)

@app.route('/get_attributes/<table_name>')
def get_attributes(table_name):
    cursor.execute(f"DESCRIBE {table_name}")
    attributes = [column[0] for column in cursor.fetchall()]
    return jsonify(attributes)

@app.route('/search', methods=['POST'])
def search_data():
    table_name = request.form['table_name']
    attribute = request.form['attribute']
    search_query = request.form['search_query']

    query = f"SELECT * FROM {table_name} WHERE {attribute} LIKE '%{search_query}%'"
    cursor.execute(query)
    results = cursor.fetchall()
    columns = [column[0] for column in cursor.description]
    data = [dict(zip(columns, row)) for row in results]
    return jsonify(data)


@app.route('/add_data', methods=['POST'])
def add_data():
    table_name = request.form['table_name']
    data = {}
    for attribute in request.form:
        if attribute != 'table_name':
            if attribute == 'Date_Closed' and not request.form[attribute]:
                data[attribute] = None  
            else:
                data[attribute] = request.form[attribute]

    if table_name in table_primary_keys:
        primary_key_column = table_primary_keys[table_name]
    else:
        return jsonify({"message": "Invalid table name"})
    
    if primary_key_column in data:
        primary_key_value = data[primary_key_column]
        query = f"SELECT * FROM {table_name} WHERE {primary_key_column} = %s"
        cursor.execute(query, (primary_key_value,))
        record = cursor.fetchone()
        if record:
            return jsonify({"message": f"Record with {primary_key_column} {primary_key_value} already exists in {table_name} table"})

    try:
        placeholders = ', '.join(['%s'] * len(data))
        columns = ', '.join(data.keys())
        values = tuple(data.values())

        query = f"INSERT INTO {table_name} ({columns}) VALUES ({placeholders})"
        cursor.execute(query, values)
        db.commit()

        return jsonify({"message": "Data added successfully"})
    except mysql.connector.errors.IntegrityError as e:
        if "foreign key constraint" in str(e):
            return jsonify({"message": "Foreign key constraint violation. Please check your input data."})
        else:
            return jsonify({"message": str(e)})

@app.route('/delete_data', methods=['POST'])
def delete_data():
    table_name = request.form['table_name']
    primary_key = request.form['primary_key']

    if table_name in table_primary_keys:
        primary_key_column = table_primary_keys[table_name]

        query = f"SELECT * FROM {table_name} WHERE {primary_key_column} = %s"
        cursor.execute(query, (primary_key,))
        record = cursor.fetchone()

        if record:
            cursor.execute("SET FOREIGN_KEY_CHECKS = 0;")

            query = f"DELETE FROM {table_name} WHERE {primary_key_column} = %s"
            cursor.execute(query, (primary_key,))
            db.commit()

            cursor.execute("SET FOREIGN_KEY_CHECKS = 1;")

            return jsonify({"message": "Data deleted successfully"})
        else:
            return jsonify({"message": f"Record with {primary_key_column} {primary_key} not found in {table_name} table"})
    else:
        return jsonify({"message": "Invalid table name"})


@app.route('/check_record_exists/<table_name>/<primary_key_value>')
def check_record_exists(table_name, primary_key_value):
    query = f"SELECT * FROM {table_name} WHERE {table_primary_keys[table_name]} = %s"
    cursor.execute(query, (primary_key_value,))
    record = cursor.fetchone()
    exists = bool(record)  
    return jsonify({"exists": exists, "data": record})


@app.route('/get_record/<table_name>/<primary_key_value>')
def get_record(table_name, primary_key_value):
    try:
        if table_name in table_primary_keys:
            primary_key_column = table_primary_keys[table_name]

            query = f"SELECT * FROM {table_name} WHERE {primary_key_column} = %s"
            cursor.execute(query, (primary_key_value,))
            record_data = cursor.fetchone()

            if record_data:
                columns = [column[0] for column in cursor.description]
                data = dict(zip(columns, record_data))
                return jsonify(data)
            else:
                return jsonify({"message": f"Record with primary key '{primary_key_value}' not found in {table_name} table"}), 404
        else:
            return jsonify({"message": "Invalid table name"}), 404
    except Exception as e:
        return jsonify({"message": "An error occurred during record retrieval. Please check server logs for details."}), 500

        
@app.route('/update_record', methods=['POST'])
def update_record():
    try:
        data = request.json
        table_name = data['table_name']
        primary_key_value = data['primary_key_value']
        column = data['column']
        new_value = data['new_value']

        # Update the record
        primary_key_column = table_primary_keys[table_name]
        query = f"UPDATE {table_name} SET {column} = %s WHERE {primary_key_column} = %s"
        cursor.execute(query, (new_value, primary_key_value))
        db.commit()

        return jsonify({"message": "Record updated successfully"})
    except Exception as e:
        return jsonify({"message": "An error occurred during record update. Please check server logs for details."}), 500
    
if __name__ == '__main__':
    app.run(debug=True)


