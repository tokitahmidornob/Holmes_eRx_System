import pandas as pd
import json

print("⚙️ Initializing Holmes Data Purifier...")

# 1. Load the massive CSV
df = pd.read_csv('Holmes_National_Grid.csv')

# 2. Drop the useless ghost columns
df = df.drop(columns=['childDose', 'renalDose'])

# 3. Fill the fatal missing data gaps
df['genericName'] = df['genericName'].fillna('Unknown Generic')
df['brandName'] = df['brandName'].fillna('Unknown Brand')

# 4. Handle the massive Dose paragraph (Rename it so it doesn't break the UI)
df = df.rename(columns={'defaultDose': 'dosageDescription'})
df['defaultDose'] = 'As directed by physician' # The new, safe UI default

# 5. Map the remaining CSV columns to your exact Mongoose Schema
df = df.rename(columns={
    'form': 'dosageForm',
    'administration': 'administrationInstruction'
})

# 6. Fill any remaining blanks with empty strings
df = df.fillna("")

# 7. Convert comma-separated text into proper Arrays for the Smart Engine
def to_list(val):
    if not val: return []
    return [x.strip() for x in str(val).split(',') if x.strip()]

df['indications'] = df['indications'].apply(to_list)
df['sideEffects'] = df['sideEffects'].apply(to_list)

# 8. Convert to a dictionary and save as a pristine JSON file
records = df.to_dict(orient='records')

with open('Holmes_Master_Import.json', 'w', encoding='utf-8') as f:
    json.dump(records, f, ensure_ascii=False, indent=2)

print(f"✅ Purification Complete! Successfully processed {len(records)} drugs.")
print("📁 Saved as: Holmes_Master_Import.json")