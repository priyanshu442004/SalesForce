import pandas as pd
import os

def generate_mock_data():
    os.makedirs("mock_data", exist_ok=True)
    
    # 1. Source Data
    source_data = {
        "Id": [1, 2, 3],
        "Name": ["Amit Sharma", "Arthita Roy", "Priyanshu Gupta"],
        "CreatedDate": ["2026-06-01", "2026-06-02", "2026-06-03"],
        "Type": ["Customer", "Partner", "Customer"],
        "Phone": ["+91 9999999999", "+91 8888888888", "+91 7777777777"],
        "Email": ["amit@mail.com", "arthita@mail.com", "priyanshu@mail.com"],
        "Status": ["Active", "Inactive", "Active"]
    }
    source_df = pd.DataFrame(source_data)
    source_df.to_excel("mock_data/source.xlsx", index=False)
    print("Generated mock_data/source.xlsx")

    # 2. Mapping Logic
    # Columns: Source Field (A), Target Field (B), Data Type (C), Default + Format (D), Master Sheet (E), Search Column (F), Copyable Column (G)
    logic_data = {
        "Source Field": ["Id", "Name", "CreatedDate", "Type", "Phone", "Email", "Status"],
        "Target Field": ["Id", "Name", "CreatedDate", "Type", "Phone", "Email", "Status"],
        "Data Type": ["number", "text", "date", "picklist", "phone", "email", "lookup"],
        "Default + Format": ["", "", "YYYY-MM-DD", "Customer=Cust, Partner=Part", "", "", ""],
        "Master Sheet": ["", "", "", "", "", "", "StatusMaster"],
        "Search Column": ["", "", "", "", "", "", "SourceStatus"],
        "Copyable Column": ["", "", "", "", "", "", "TargetStatus"]
    }
    logic_df = pd.DataFrame(logic_data)
    logic_df.to_excel("mock_data/logic.xlsx", index=False)
    print("Generated mock_data/logic.xlsx")

    # 3. Master Metadata
    # We will write an excel file with multiple sheets, particularly the 'StatusMaster' sheet.
    with pd.ExcelWriter("mock_data/master.xlsx") as writer:
        # StatusMaster sheet
        status_data = {
            "SourceStatus": ["Active", "Inactive"],
            "TargetStatus": ["A", "I"]
        }
        status_df = pd.DataFrame(status_data)
        status_df.to_excel(writer, sheet_name="StatusMaster", index=False)
        
        # General info sheet just in case
        info_df = pd.DataFrame({"Info": ["Salesforce Metadata", "Version 1.0"]})
        info_df.to_excel(writer, sheet_name="GeneralInfo", index=False)
    print("Generated mock_data/master.xlsx")

if __name__ == "__main__":
    generate_mock_data()
