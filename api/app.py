import os
from flask import Flask, render_template, request, send_file
from pymongo import MongoClient
from collections import defaultdict
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
from reportlab.lib import colors
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.enums import TA_CENTER
from reportlab.lib.styles import getSampleStyleSheet
from reportlab.lib.units import inch
from io import BytesIO

app = Flask(
    __name__,
    template_folder="../templates",
    static_folder="../static"
)

MONGO_URI = os.environ.get("MONGO_URI")

client = MongoClient(MONGO_URI)
db = client["exam_system"]

generated_data = {}

# ---------------- HOME PAGE ----------------

@app.route("/")
def home():
    return render_template("home.html")

# ---------------- SEATING ARRANGEMENT ----------------

@app.route("/seating")
def seating():
    return render_template("seating.html")

# ---------------- TIMETABLE GENERATION ----------------

@app.route("/timetable")
def timetable():
    return render_template("timetable.html")

@app.route("/generate", methods=["POST"])
def generate():

    raw_text = request.form["raw_input"]
    senior_scheme = request.form["senior_scheme"]

    grouped = defaultdict(list)

    lines = [line.strip() for line in raw_text.split("\n") if line.strip()]
    ignore_words = {"Date", "Time", "Exam Slot", "Semester"}
    lines = [line for line in lines if line not in ignore_words]

    for i in range(0, len(lines), 5):

        try:
            day = lines[i]
            date_session = lines[i+1]
            time = lines[i+2]
            slot_line = lines[i+3]
            semester_line = lines[i+4]
        except IndexError:
            break

        parts = date_session.split()
        date = parts[0]
        session = parts[1] if len(parts) > 1 else ""

        slot = slot_line.split()[0]
        semester_list = semester_line.split(",")

        for sem in semester_list:

            sem = sem.strip()

            if sem in ["S1","S2","S3","S4","S5","S6"]:
                scheme_to_use = "2024"
            else:
                scheme_to_use = senior_scheme

            subject_data = db.schemes.find_one({
                "scheme": scheme_to_use,
                "semester": sem
            })

            if subject_data:
                subject = subject_data["subjects"].get(slot, "Not Found")
            else:
                subject = "Not Found"

            grouped[sem].append({
                "date": date,
                "session": session,
                "time": time,
                "slot": slot,
                "subject": subject
            })

    global generated_data
    generated_data = grouped

    return render_template("output.html", data=grouped)
#------------------SIGNPAGE----------------#
@app.route("/signpage")
def signpage():
    return render_template("signpage.html")
# ---------------- FACULTY MAPPING ----------------

import json
import math
import pandas as pd
from flask import redirect, url_for

TEACHER_FILE = "teachers.json"
MTECH_FILE = "mtech.json"
SCHEDULE_FILE = "schedule.json"


def load_teachers():
    with open(TEACHER_FILE) as f:
        return json.load(f)

def save_teachers(data):
    with open(TEACHER_FILE, "w") as f:
        json.dump(data, f, indent=4)

def load_mtech():
    with open(MTECH_FILE) as f:
        return json.load(f)

def save_mtech(data):
    with open(MTECH_FILE, "w") as f:
        json.dump(data, f, indent=4)


@app.route("/faculty")
def faculty():
    return render_template("index3.html")


@app.route("/faculty_generate", methods=["POST"])
def faculty_generate():

    teachers = load_teachers()
    mtech_list = load_mtech()

    for t in teachers:
        t["count"] = 0

    for m in mtech_list:
        m["count"] = 0

    days = int(request.form["days"])
    classrooms = request.form.getlist("classroom")
    students = request.form.getlist("students")

    allocation = []

    for day in range(1, days + 1):

        used_today = set()

        eligible_teachers = [
            t for t in teachers
            if t["role"] not in ["HOD", "Professor"]
        ]

        sorted_teachers = sorted(
            eligible_teachers,
            key=lambda x: (x["count"], -x["priority"])
        )

        teacher_pointer = 0

        for i in range(len(classrooms)):

            room = classrooms[i]
            stu = int(students[i])

            if stu == 0:
                continue

            total_invigilators = math.ceil(stu / 20)

            teacher_needed = 1
            mtech_needed = total_invigilators - 1

            while teacher_pointer < len(sorted_teachers):

                teacher = sorted_teachers[teacher_pointer]

                if teacher["name"] in used_today:
                    teacher_pointer += 1
                    continue

                if "allowed_rooms" in teacher:
                    if room not in teacher["allowed_rooms"]:
                        teacher_pointer += 1
                        continue

                break

            if teacher_pointer >= len(sorted_teachers):
                continue

            teacher = sorted_teachers[teacher_pointer]

            allocation.append({
                "day": f"Day {day}",
                "classroom": room,
                "teacher": teacher["name"],
                "role": teacher["role"]
            })

            teacher["count"] += 1
            used_today.add(teacher["name"])

            teacher_pointer += 1

            for j in range(mtech_needed):

                mtech_sorted = sorted(mtech_list, key=lambda x: x["count"])
                mtech = mtech_sorted[0]

                allocation.append({
                    "day": f"Day {day}",
                    "classroom": room,
                    "teacher": mtech["name"],
                    "role": "MTech Scholar"
                })

                mtech["count"] += 1

    save_teachers(teachers)
    save_mtech(mtech_list)

    with open(SCHEDULE_FILE, "w") as f:
        json.dump(allocation, f, indent=4)

    return redirect(url_for("faculty_schedule"))


@app.route("/faculty_schedule")
def faculty_schedule():

    teachers = load_teachers()

    with open(SCHEDULE_FILE) as f:
        allocation = json.load(f)

    schedule_table = {}

    for a in allocation:

        day = a["day"]
        room = a["classroom"]
        teacher = a["teacher"]

        if room not in schedule_table:
            schedule_table[room] = {}

        if day not in schedule_table[room]:
            schedule_table[room][day] = []

        schedule_table[room][day].append(teacher)

    return render_template(
        "result3.html",
        allocation=allocation,
        teachers=teachers,
        schedule_table=schedule_table
    )


@app.route("/faculty_edit", methods=["POST"])
def faculty_edit():

    teachers = load_teachers()

    old_teacher = request.form["old_teacher"]
    new_teacher = request.form["new_teacher"]
    classroom = request.form["classroom"]
    day = request.form["day"]

    with open(SCHEDULE_FILE) as f:
        allocation = json.load(f)

    for a in allocation:
        if a["day"] == day and a["teacher"] == new_teacher and a["classroom"] != classroom:
            return f"{new_teacher} already has duty on {day}"

    for t in teachers:
        if t["name"] == old_teacher:
            t["count"] -= 1
        if t["name"] == new_teacher:
            t["count"] += 1

    save_teachers(teachers)

    for a in allocation:
        if a["teacher"] == old_teacher and a["classroom"] == classroom and a["day"] == day:
            a["teacher"] = new_teacher

    with open(SCHEDULE_FILE, "w") as f:
        json.dump(allocation, f, indent=4)

    return redirect(url_for("faculty_schedule"))


@app.route("/faculty_download")
def faculty_download():

    from io import BytesIO

    with open(SCHEDULE_FILE) as f:
        allocation = json.load(f)

    df = pd.DataFrame(allocation)

    output = BytesIO()

    with pd.ExcelWriter(output, engine="openpyxl") as writer:
        df.to_excel(writer, index=False, sheet_name="Schedule")

    output.seek(0)

    return send_file(
        output,
        as_attachment=True,
        download_name="invigilation_schedule.xlsx",
        mimetype="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    )
# ---------------- PDF DOWNLOAD ----------------

@app.route("/download-pdf")
def download_pdf():

    buffer = BytesIO()
    doc = SimpleDocTemplate(buffer)
    elements = []
    styles = getSampleStyleSheet()

    heading_style = ParagraphStyle(
        name="CustomHeading",
        parent=styles["Normal"],
        fontName="Times-Bold",
        fontSize=14,
        alignment=TA_CENTER,
        spaceAfter=6
    )

    elements.append(Paragraph("DEPT. OF COMPUTER SCIENCE & ENGINEERING", heading_style))
    elements.append(Paragraph("GOVT. ENGINEERING COLLEGE, THRISSUR", heading_style))
    elements.append(Paragraph("SERIES TEST TIMETABLE", heading_style))
    elements.append(Spacer(1, 0.4 * inch))

    for semester, exams in generated_data.items():

        elements.append(Paragraph(f"<b>{semester}</b>", styles["Heading2"]))
        elements.append(Spacer(1, 0.2 * inch))

        table_data = [["Date", "Session", "Time", "Slot", "Subject"]]

        for exam in exams:
            table_data.append([
                exam["date"],
                exam["session"],
                exam["time"],
                exam["slot"],
                exam["subject"]
            ])

        table = Table(table_data, repeatRows=1)

        table.setStyle(TableStyle([
            ("BACKGROUND", (0,0), (-1,0), colors.lightgrey),
            ("GRID", (0,0), (-1,-1), 0.5, colors.grey),
            ("FONTNAME", (0,0), (-1,-1), "Helvetica"),
        ]))

        elements.append(table)
        elements.append(Spacer(1, 0.4 * inch))

    doc.build(elements)
    buffer.seek(0)

    return send_file(buffer,
                     as_attachment=True,
                     download_name="Exam_Time_Table.pdf",
                     mimetype="application/pdf")


if __name__ == "__main__":
    app.run()