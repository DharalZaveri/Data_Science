import tkinter as tk
import joblib

# Load the trained machine learning model
model = joblib.load('diabetes_model.joblib')

# Define a function to handle the button click event
def predict_diabetes():
    # Get the input values from the GUI
    glucose = float(glucose_entry.get())
    bmi = float(bmi_entry.get())
    age = float(age_entry.get())
    blood_pressure = float(blood_pressure_entry.get())

    # Use the trained model to make a prediction
    prediction = model.predict([[glucose, bmi, age, blood_pressure]])

    # Update the output label with the prediction
    if prediction == 0:
        output_label.config(text='No diabetes')
    else:
        output_label.config(text='Diabetes')

# Create the main window
root = tk.Tk()
root.title('Diabetes Prediction System')

# Create the input labels and entry fields
glucose_label = tk.Label(root, text='Glucose:')
glucose_label.grid(row=0, column=0)
glucose_entry = tk.Entry(root)
glucose_entry.grid(row=0, column=1)

bmi_label = tk.Label(root, text='BMI:')
bmi_label.grid(row=1, column=0)
bmi_entry = tk.Entry(root)
bmi_entry.grid(row=1, column=1)

age_label = tk.Label(root, text='Age:')
age_label.grid(row=2, column=0)
age_entry = tk.Entry(root)
age_entry.grid(row=2, column=1)

blood_pressure_label = tk.Label(root, text='Blood Pressure:')
blood_pressure_label.grid(row=3, column=0)
blood_pressure_entry = tk.Entry(root)
blood_pressure_entry.grid(row=3, column=1)

# Create the button to trigger the prediction
predict_button = tk.Button(root, text='Predict', command=predict_diabetes)
predict_button.grid(row=4, column=0)

# Create the output label
output_label = tk.Label(root, text='')
output_label.grid(row=4, column=1)

# Start the GUI event loop
root.mainloop()
