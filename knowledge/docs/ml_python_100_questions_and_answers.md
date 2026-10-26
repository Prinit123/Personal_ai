# 📚 NILESH AI — 100+ Solved Questions & Answers
### Comprehensive Handbook: NumPy, Pandas, Data Science, Machine Learning & Deep Learning

---

## 📌 TABLE OF CONTENTS
1. [PART 1: NumPy Mastery (Q1 – Q25)](#part-1-numpy-mastery)
2. [PART 2: Pandas Data Science (Q26 – Q50)](#part-2-pandas-data-science)
3. [PART 3: Data Preprocessing & Feature Engineering (Q51 – Q65)](#part-3-data-preprocessing--feature-engineering)
4. [PART 4: Machine Learning Algorithms & Models (Q66 – Q85)](#part-4-machine-learning-algorithms--models)
5. [PART 5: Model Evaluation & Hyperparameter Tuning (Q86 – Q95)](#part-5-model-evaluation--hyperparameter-tuning)
6. [PART 6: Deep Learning & Generative AI Essentials (Q96 – Q105)](#part-6-deep-learning--generative-ai-essentials)

---

# PART 1: NumPy Mastery

### Q1: How do you create a 1D, 2D, and 3D NumPy array from Python lists?
**Concept:** `np.array()` converts standard Python lists into fast, contiguous C-arrays.
```python
import numpy as np

arr1d = np.array([1, 2, 3])
arr2d = np.array([[1, 2, 3], [4, 5, 6]])
arr3d = np.array([[[1, 2], [3, 4]], [[5, 6], [7, 8]]])

print(f"1D shape: {arr1d.shape}, 2D shape: {arr2d.shape}, 3D shape: {arr3d.shape}")
# Output: 1D shape: (3,), 2D shape: (2, 3), 3D shape: (2, 2, 2)
```

### Q2: How do you generate an array of zeros, ones, and a constant value?
```python
zeros = np.zeros((2, 3))        # 2 rows, 3 cols of 0.0
ones  = np.ones((3, 2))         # 3 rows, 2 cols of 1.0
fives = np.full((2, 2), 5.0)    # 2 rows, 2 cols filled with 5.0
```

### Q3: How do you create evenly spaced numbers over a range using `np.arange` vs `np.linspace`?
**Difference:** `arange(start, stop, step)` uses a step size; `linspace(start, stop, num)` generates an exact number of evenly spaced samples.
```python
range_arr = np.arange(0, 10, 2)       # [0, 2, 4, 6, 8]
linear_arr = np.linspace(0, 1, 5)     # [0.0, 0.25, 0.5, 0.75, 1.0]
```

### Q4: How do you reshape a 1D array of 12 elements into a 3x4 2D matrix?
```python
arr = np.arange(12)
reshaped = arr.reshape(3, 4)  # 3 rows, 4 columns
# Use -1 to let NumPy infer the dimension automatically:
auto_reshaped = arr.reshape(2, -1)  # (2, 6)
```

### Q5: How do you slice rows and columns in a 2D array (e.g., first 2 rows, last 2 columns)?
```python
matrix = np.array([
    [10, 20, 30, 40],
    [50, 60, 70, 80],
    [90, 100, 110, 120]
])
# matrix[row_slice, col_slice]
sub = matrix[0:2, 2:4]
# Output: [[30, 40], [70, 80]]
```

### Q6: What is Boolean Masking in NumPy? Filter all numbers greater than 50.
```python
arr = np.array([12, 55, 78, 23, 90, 44])
mask = arr > 50
filtered = arr[mask]
print(filtered)  # [55, 78, 90]
```

### Q7: How does NumPy Broadcasting work when adding a 1D vector to a 2D matrix?
**Rule:** Trailing dimensions must match or one of them must be 1.
```python
matrix = np.array([[1, 2, 3], [4, 5, 6]])  # shape: (2, 3)
row_add = np.array([10, 20, 30])           # shape: (3,)
result = matrix + row_add
# Output: [[11, 22, 33], [14, 25, 36]]
```

### Q8: How do you calculate element-wise multiplication vs Matrix Multiplication (Dot Product)?
```python
A = np.array([[1, 2], [3, 4]])
B = np.array([[2, 0], [1, 2]])

element_wise = A * B       # [[2, 0], [3, 8]]
matrix_dot   = A @ B       # or np.dot(A, B) -> [[4, 4], [10, 8]]
```

### Q9: How do you compute statistical aggregates (Mean, Median, Standard Deviation, Variance)?
```python
data = np.array([10, 20, 30, 40, 50])
print(f"Mean: {np.mean(data)}")       # 30.0
print(f"Median: {np.median(data)}")   # 30.0
print(f"Std Dev: {np.std(data):.2f}") # 14.14
print(f"Variance: {np.var(data)}")    # 200.0
```

### Q10: How do you find the index of the maximum or minimum value along an axis (`np.argmax`, `np.argmin`)?
```python
scores = np.array([[85, 92, 78], [88, 76, 95]])
# Max score index per student (axis 1):
print(np.argmax(scores, axis=1))  # [1, 2] (Student 0 highest at idx 1, Student 1 at idx 2)
```

### Q11: How do you replace conditional values using `np.where`?
```python
grades = np.array([45, 80, 33, 92, 58])
# If grade >= 50: 'PASS', else 'FAIL'
status = np.where(grades >= 50, 'PASS', 'FAIL')
# Output: ['FAIL', 'PASS', 'FAIL', 'PASS', 'PASS']
```

### Q12: How do you find unique elements and their frequencies in a NumPy array?
```python
categories = np.array(['cat', 'dog', 'cat', 'bird', 'dog', 'cat'])
uniques, counts = np.unique(categories, return_counts=True)
# uniques: ['bird', 'cat', 'dog'], counts: [1, 3, 2]
```

### Q13: How do you stack two arrays vertically (`vstack`) and horizontally (`hstack`)?
```python
a = np.array([1, 2, 3])
b = np.array([4, 5, 6])
v_stacked = np.vstack((a, b))  # 2x3 matrix
h_stacked = np.hstack((a, b))  # 1x6 array: [1, 2, 3, 4, 5, 6]
```

### Q14: How do you flatten a multi-dimensional array into 1D (`flatten` vs `ravel`)?
**Difference:** `flatten()` returns a deep copy; `ravel()` returns a memory view (faster).
```python
arr = np.array([[1, 2], [3, 4]])
flat = arr.ravel()  # [1, 2, 3, 4]
```

### Q15: How do you generate random numbers from a Uniform distribution vs Normal distribution?
```python
uniform = np.random.rand(3)          # Uniform between 0 and 1
normal  = np.random.randn(3)         # Standard normal distribution (mean=0, std=1)
integers = np.random.randint(1, 100, size=5) # 5 random ints between 1 and 99
```

### Q16: How do you set a random seed for reproducible results?
```python
np.random.seed(42)  # Ensures the same random numbers are generated each time
```

### Q17: How do you calculate the Transpose of a matrix?
```python
mat = np.array([[1, 2, 3], [4, 5, 6]])
mat_t = mat.T  # Shape becomes (3, 2)
```

### Q18: How do you compute the Inverse of a square matrix using `np.linalg.inv`?
```python
A = np.array([[2, 1], [5, 3]])
A_inv = np.linalg.inv(A)
# Check: A @ A_inv equals identity matrix: np.eye(2)
```

### Q19: How do you calculate the Determinant of a matrix?
```python
det = np.linalg.det(A)  # 2*3 - 1*5 = 1.0
```

### Q20: How do you compute Eigenvalues and Eigenvectors?
```python
eig_vals, eig_vecs = np.linalg.eig(A)
```

### Q21: How do you calculate pairwise Euclidean Distance between two vectors?
```python
v1 = np.array([1, 2, 3])
v2 = np.array([4, 6, 8])
dist = np.linalg.norm(v1 - v2)  # sqrt(3^2 + 4^2 + 5^2) = 7.071
```

### Q22: How do you clip outlier values in an array to min and max boundaries?
```python
raw = np.array([5, 12, 150, -20, 80])
clipped = np.clip(raw, a_min=0, a_max=100)
# Output: [5, 12, 100, 0, 80]
```

### Q23: How do you check if any or all elements satisfy a condition?
```python
nums = np.array([2, 4, 6, 8])
all_even = np.all(nums % 2 == 0)   # True
has_ten  = np.any(nums == 10)       # False
```

### Q24: How do you save and load NumPy arrays to disk in binary `.npy` format?
```python
np.save('my_array.npy', arr)
loaded = np.load('my_array.npy')
```

### Q25: How do you vectorise a custom Python function in NumPy?
```python
def classify_age(age):
    return "Child" if age < 18 else "Adult"

v_classify = np.vectorize(classify_age)
ages = np.array([12, 25, 8, 45])
print(v_classify(ages))  # ['Child' 'Adult' 'Child' 'Adult']
```

---

# PART 2: Pandas Data Science

### Q26: How do you create a DataFrame from a Python Dictionary?
```python
import pandas as pd

data = {
    'Name': ['Aarav', 'Diya', 'Rohan'],
    'Age': [24, 28, 22],
    'City': ['Mumbai', 'Delhi', 'Bangalore']
}
df = pd.DataFrame(data)
```

### Q27: How do you read and write CSV files with custom separators and index handling?
```python
df = pd.read_csv('students.csv', sep=',')
df.to_csv('cleaned_students.csv', index=False)  # index=False avoids writing extra col
```

### Q28: How do you inspect the structure, datatypes, and summary statistics of a DataFrame?
```python
df.head(5)       # First 5 rows
df.info()         # Data types, non-null counts, memory usage
df.describe()     # Count, mean, std, min, 25%, 50%, 75%, max
df.shape          # (num_rows, num_columns)
```

### Q29: What is the difference between `.loc[]` and `.iloc[]` in Pandas?
* **`.loc[]`:** Label-based indexing (uses column names and index labels).
* **`.iloc[]`:** Integer position-based indexing (uses 0-based integer indexes).
```python
# .loc: row 0 to 2, column 'Name' and 'Age'
subset1 = df.loc[0:2, ['Name', 'Age']]
# .iloc: first 3 rows, first 2 columns
subset2 = df.iloc[0:3, 0:2]
```

### Q30: How do you filter rows based on multiple conditions (AND `&`, OR `|`)?
```python
filtered = df[(df['Age'] > 23) & (df['City'] == 'Delhi')]
```

### Q31: How do you detect and count missing values (`NaN`) in each column?
```python
missing_counts = df.isna().sum()
missing_percent = (df.isna().sum() / len(df)) * 100
```

### Q32: How do you drop missing rows vs fill missing values with mean or mode?
```python
# Drop rows where any column is NaN
df_dropped = df.dropna()

# Fill missing Age with Mean
df['Age'] = df['Age'].fillna(df['Age'].mean())

# Fill missing City with Mode (most frequent)
df['City'] = df['City'].fillna(df['City'].mode()[0])
```

### Q33: How do you rename DataFrame columns?
```python
df.rename(columns={'Name': 'Full_Name', 'Age': 'Student_Age'}, inplace=True)
```

### Q34: How do you count unique category frequencies using `value_counts`?
```python
counts = df['City'].value_counts()
proportions = df['City'].value_counts(normalize=True)  # Percentage distribution
```

### Q35: How do you group data and perform aggregate calculations (`groupby`)?
```python
# Average age and count of students per city
grouped = df.groupby('City')['Age'].agg(['mean', 'count', 'max'])
```

### Q36: How do you apply custom functions using `.apply()` and `lambda`?
```python
df['Age_In_Months'] = df['Age'].apply(lambda x: x * 12)
```

### Q37: How do you drop duplicate rows based on specific columns?
```python
df_unique = df.drop_duplicates(subset=['Name', 'City'], keep='first')
```

### Q38: How do you sort values by single or multiple columns?
```python
df_sorted = df.sort_values(by=['City', 'Age'], ascending=[True, False])
```

### Q39: How do you merge/join two DataFrames like an SQL Inner/Left Join?
```python
df_students = pd.DataFrame({'id': [1, 2], 'name': ['Raj', 'Pooja']})
df_marks    = pd.DataFrame({'id': [1, 2], 'marks': [88, 92]})

merged = pd.merge(df_students, df_marks, on='id', how='inner')
```

### Q40: How do you concatenate two DataFrames vertically?
```python
df_combined = pd.concat([df1, df2], axis=0, ignore_index=True)
```

### Q41: How do you create a Pivot Table in Pandas?
```python
pivot = df.pivot_table(index='Department', columns='Gender', values='Salary', aggfunc='mean')
```

### Q42: How do you convert a string column to `datetime` and extract year, month, day?
```python
df['Date'] = pd.to_datetime(df['Date_Str'])
df['Year']  = df['Date'].dt.year
df['Month'] = df['Date'].dt.month_name()
df['Day']   = df['Date'].dt.day
```

### Q43: How do you use string accessor `.str` methods for text cleaning?
```python
df['City'] = df['City'].str.strip().str.lower().str.replace(' ', '_')
```

### Q44: How do you convert continuous numbers into discrete bins (`pd.cut`)?
```python
# Group ages into Child, Adult, Senior
bins = [0, 18, 60, 100]
labels = ['Child', 'Adult', 'Senior']
df['Age_Group'] = pd.cut(df['Age'], bins=bins, labels=labels)
```

### Q45: How do you detect numerical outliers using the IQR (Interquartile Range) method?
```python
Q1 = df['Salary'].quantile(0.25)
Q3 = df['Salary'].quantile(0.75)
IQR = Q3 - Q1
lower_bound = Q1 - 1.5 * IQR
upper_bound = Q3 + 1.5 * IQR

outliers = df[(df['Salary'] < lower_bound) | (df['Salary'] > upper_bound)]
```

### Q46: How do you reset an index after filtering or dropping rows?
```python
df_clean = df[df['Age'] > 20].reset_index(drop=True)
```

### Q47: How do you sample a random 10% fraction of data for rapid prototyping?
```python
sample_df = df.sample(frac=0.10, random_state=42)
```

### Q48: How do you change data types of columns using `.astype()`?
```python
df['Age'] = df['Age'].astype(int)
df['Is_Active'] = df['Is_Active'].astype(bool)
```

### Q49: How do you create One-Hot Encoded dummy variables in Pandas?
```python
df_dummies = pd.get_dummies(df, columns=['City'], drop_first=True, dtype=int)
```

### Q50: How do you compute the correlation matrix of numerical features?
```python
corr = df.select_dtypes(include=['float64', 'int64']).corr()
```

---

# PART 3: Data Preprocessing & Feature Engineering

### Q51: Why do we split data into Train and Test sets, and how is it done?
**Reason:** To test our model on unseen data to ensure it generalizes and does not overfit.
```python
from sklearn.model_selection import train_test_split

X_train, X_test, y_train, y_test = train_test_split(
    X, y, test_size=0.20, random_state=42, stratify=y  # stratify keeps class proportions
)
```

### Q52: What is the difference between `StandardScaler` and `MinMaxScaler`?
* **`StandardScaler`:** Transforms data so Mean = 0, Std = 1 (Formula: $\frac{x - \mu}{\sigma}$). Good for algorithms assuming normality (Linear/Logistic, SVM, Neural Nets).
* **`MinMaxScaler`:** Scales features strictly between 0 and 1 (Formula: $\frac{x - \min}{\max - \min}$). Good for algorithms sensitive to positive bounds (e.g. image pixels).
```python
from sklearn.preprocessing import StandardScaler

scaler = StandardScaler()
X_train_scaled = scaler.fit_transform(X_train)
X_test_scaled  = scaler.transform(X_test)  # ONLY transform test set, NEVER fit!
```

### Q53: What is Data Leakage and how do you prevent it during scaling?
**Data Leakage:** When information from the test set leaks into model training.
**Prevention:** Compute `fit()` ONLY on `X_train`. Use `transform()` on `X_test`.

### Q54: How do you handle categorical features using Scikit-Learn's `OneHotEncoder`?
```python
from sklearn.preprocessing import OneHotEncoder

ohe = OneHotEncoder(drop='first', sparse_output=False, handle_unknown='ignore')
encoded_train = ohe.fit_transform(X_train[['City']])
encoded_test  = ohe.transform(X_test[['City']])
```

### Q55: How do you encode ordinal categorical features (e.g. Low, Med, High) using `OrdinalEncoder`?
```python
from sklearn.preprocessing import OrdinalEncoder

edu_order = [['High School', 'Bachelors', 'Masters', 'PhD']]
encoder = OrdinalEncoder(categories=edu_order)
X['Education_Encoded'] = encoder.fit_transform(X[['Education']])
```

### Q56: How do you impute missing numerical data using `SimpleImputer`?
```python
from sklearn.impute import SimpleImputer

imputer = SimpleImputer(strategy='median')
X_train_imp = imputer.fit_transform(X_train)
X_test_imp  = imputer.transform(X_test)
```

### Q57: How do you build an end-to-end Machine Learning `Pipeline` in Scikit-Learn?
```python
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler
from sklearn.linear_model import LogisticRegression

pipe = Pipeline([
    ('scaler', StandardScaler()),
    ('model', LogisticRegression())
])
pipe.fit(X_train, y_train)
accuracy = pipe.score(X_test, y_test)
```

### Q58: How do you use `ColumnTransformer` to apply different transformations to numerical vs categorical columns?
```python
from sklearn.compose import ColumnTransformer
from sklearn.preprocessing import StandardScaler, OneHotEncoder

preprocessor = ColumnTransformer(transformers=[
    ('num', StandardScaler(), ['age', 'salary']),
    ('cat', OneHotEncoder(drop='first'), ['gender', 'city'])
])
X_train_proc = preprocessor.fit_transform(X_train)
```

### Q59: How do you handle severe class imbalance (e.g. 99% non-fraud vs 1% fraud)?
1. Use `class_weight='balanced'` in estimators.
2. Use SMOTE (Synthetic Minority Over-sampling Technique) from `imblearn`.
```python
from imblearn.over_sampling import SMOTE
smote = SMOTE(random_state=42)
X_resampled, y_resampled = smote.fit_resample(X_train, y_train)
```

### Q60: What are Polynomial Features and when should they be created?
**Concept:** Generates interaction and squared terms ($x_1^2, x_1x_2, x_2^2$) to capture non-linear relationships with linear models.
```python
from sklearn.preprocessing import PolynomialFeatures
poly = PolynomialFeatures(degree=2, include_bias=False)
X_poly = poly.fit_transform(X)
```

### Q61: What is Target Encoding and why must you use cross-validation when doing it?
**Concept:** Replacing a category with the mean of the target variable for that category. Cross-validation avoids target leakage.

### Q62: How do you select top $K$ features using `SelectKBest` and ANOVA F-test?
```python
from sklearn.feature_selection import SelectKBest, f_classif
selector = SelectKBest(score_func=f_classif, k=5)
X_selected = selector.fit_transform(X, y)
```

### Q63: How do you log-transform skewed features to achieve a normal distribution?
```python
import numpy as np
# log1p handles 0 safely (log(1 + x))
df['Sales_Log'] = np.log1p(df['Sales'])
```

### Q64: How do you create lag features for Time-Series forecasting?
```python
# Predict today's temperature from yesterday's temperature:
df['Temp_Lag1'] = df['Temperature'].shift(1)
```

### Q65: How do you save and load trained Scikit-Learn models using `joblib`?
```python
import joblib

joblib.dump(pipe, 'trained_pipeline.joblib')
loaded_model = joblib.load('trained_pipeline.joblib')
preds = loaded_model.predict(X_new)
```

---

# PART 4: Machine Learning Algorithms & Models

### Q66: Write a complete Linear Regression model and explain its coefficients ($w$) and intercept ($b$).
```python
from sklearn.linear_model import LinearRegression

model = LinearRegression()
model.fit(X_train, y_train)
print(f"Weights (Slopes): {model.coef_}")
print(f"Bias (Intercept): {model.intercept_}")
```

### Q67: What is the cost function minimized in Linear Regression?
**Answer:** Mean Squared Error (MSE) / Ordinary Least Squares (OLS):
$$J(w, b) = \frac{1}{N} \sum_{i=1}^N (y_i - \hat{y}_i)^2$$

### Q68: Write a complete Logistic Regression classifier and explain the Sigmoid function.
**Sigmoid Formula:** $\sigma(z) = \frac{1}{1 + e^{-z}}$, squashes any real number to a probability between 0 and 1.
```python
from sklearn.linear_model import LogisticRegression

clf = LogisticRegression()
clf.fit(X_train, y_train)
probabilities = clf.predict_proba(X_test)  # [P(Class 0), P(Class 1)]
predictions   = clf.predict(X_test)
```

### Q69: How do Decision Trees split nodes? What are Gini Impurity and Entropy?
* **Gini Impurity:** Measures probability of misclassifying a randomly chosen element ($1 - \sum p_i^2$). Gini = 0 means a completely pure node.
* **Entropy / Information Gain:** Measures disorder or uncertainty ($-\sum p_i \log_2(p_i)$).
```python
from sklearn.tree import DecisionTreeClassifier
tree = DecisionTreeClassifier(criterion='gini', max_depth=3, random_state=42)
tree.fit(X_train, y_train)
```

### Q70: How do you prevent a Decision Tree from Overfitting?
1. Limit `max_depth` (e.g. 3 to 5).
2. Set `min_samples_split` (e.g. 10).
3. Set `min_samples_leaf` (e.g. 5).
4. Limit `max_leaf_nodes`.

### Q71: Write a Random Forest model and explain Bagging (Bootstrap Aggregation).
**Bagging:** Creates $N$ subsets of data with replacement (bootstrapping), trains an independent tree on each, and takes the average/majority vote (aggregation).
```python
from sklearn.ensemble import RandomForestClassifier

rf = RandomForestClassifier(n_estimators=100, max_depth=5, random_state=42, n_jobs=-1)
rf.fit(X_train, y_train)
```

### Q72: How do you extract Feature Importances from a Random Forest?
```python
import pandas as pd
importance_df = pd.DataFrame({
    'Feature': feature_names,
    'Importance': rf.feature_importances_
}).sort_values('Importance', ascending=False)
```

### Q73: Write an SVM Classifier and explain the role of $C$ and $\gamma$ (gamma).
* **$C$:** Controls penalty for misclassification (Small $C$ = softer margin, avoids overfitting; Large $C$ = strict margin, risk of overfitting).
* **$\gamma$ (Gamma):** Controls how far the influence of a single training example reaches.
```python
from sklearn.svm import SVC
svm = SVC(C=1.0, kernel='rbf', gamma='scale')
svm.fit(X_train, y_train)
```

### Q74: Write a K-Nearest Neighbors (KNN) classifier and explain how to choose optimal $K$.
```python
from sklearn.neighbors import KNeighborsClassifier
# Use an odd number to avoid tie votes
knn = KNeighborsClassifier(n_neighbors=5, metric='minkowski', p=2) # p=2 is Euclidean
knn.fit(X_train, y_train)
```

### Q75: How does Naive Bayes work and why is it called "Naive"?
**Bayes Theorem:** $P(A|B) = \frac{P(B|A) P(A)}{P(B)}$.
**Why Naive?** It assumes all input features are 100% independent of each other (which is rarely true in real life, but works remarkably well for spam detection!).
```python
from sklearn.naive_bayes import MultinomialNB
nb = MultinomialNB()
nb.fit(X_train, y_train)
```

### Q76: What is the difference between Bagging and Boosting?
* **Bagging (e.g. Random Forest):** Trains trees in **parallel**; reduces **variance** (prevents overfitting).
* **Boosting (e.g. XGBoost, AdaBoost):** Trains trees in **series** (sequentially); each tree learns from previous mistakes; reduces **bias**.

### Q77: Write an XGBoost Classifier in Python.
```python
from xgboost import XGBClassifier

xgb = XGBClassifier(n_estimators=100, learning_rate=0.05, max_depth=4, random_state=42)
xgb.fit(X_train, y_train)
```

### Q78: Write a K-Means Clustering model and explain the Elbow Method.
**Elbow Method:** Plot Inertia (Within-Cluster Sum of Squares) against $K$. The "elbow" point is the optimal number of clusters.
```python
from sklearn.cluster import KMeans

kmeans = KMeans(n_clusters=3, random_state=42, n_init='auto')
clusters = kmeans.fit_predict(X)
print("Cluster Centers:", kmeans.cluster_centers_)
```

### Q79: What is the Silhouette Score in Clustering?
**Score (-1 to +1):** Measures how similar a point is to its own cluster compared to other clusters (+1 = well clustered, 0 = on border, negative = placed in wrong cluster).
```python
from sklearn.metrics import silhouette_score
score = silhouette_score(X, clusters)
```

### Q80: How does PCA (Principal Component Analysis) work and how do you plot Explained Variance?
```python
from sklearn.decomposition import PCA

pca = PCA(n_components=2)
X_pca = pca.fit_transform(X_scaled)
print("Explained Variance Ratio:", pca.explained_variance_ratio_)
```

### Q81: What is Hierarchical Agglomerative Clustering?
**Concept:** "Bottom-up" approach where each point starts in its own cluster and pairs are iteratively merged based on distance (visualized using a **Dendrogram**).

### Q82: What is DBSCAN and why is it better than K-Means for odd-shaped clusters?
**Answer:** DBSCAN groups points based on density (`eps` and `min_samples`). It can find arbitrarily shaped clusters and automatically flags isolated points as **noise / outliers (-1)**.

### Q83: What is the Bias-Variance Tradeoff?
* **High Bias (Underfitting):** Model is too simple (e.g. linear model on curved data). Poor training and testing score.
* **High Variance (Overfitting):** Model memorizes training noise (e.g. unconstrained tree). Great training score, terrible testing score.

### Q84: What is Early Stopping in Iterative Models?
**Answer:** Halting model training when the validation loss stops improving for $N$ consecutive epochs, preventing overfitting.

### Q85: What is an Ensemble Voting Classifier?
```python
from sklearn.ensemble import VotingClassifier

voting_clf = VotingClassifier(
    estimators=[('lr', clf_lr), ('rf', clf_rf), ('svm', clf_svm)],
    voting='soft'  # 'soft' averages predicted probabilities
)
voting_clf.fit(X_train, y_train)
```

---

# PART 5: Model Evaluation & Hyperparameter Tuning

### Q86: Calculate Confusion Matrix values (TP, TN, FP, FN) in Scikit-Learn.
```python
from sklearn.metrics import confusion_matrix

cm = confusion_matrix(y_true, y_pred)
# [ [TN, FP],
#   [FN, TP] ]
tn, fp, fn, tp = cm.ravel()
```

### Q87: Define Accuracy, Precision, Recall, and F1-Score with formulas.
* **Accuracy:** $\frac{TP + TN}{TP + TN + FP + FN}$
* **Precision:** $\frac{TP}{TP + FP}$ (Out of all predicted positives, how many are true?)
* **Recall (Sensitivity):** $\frac{TP}{TP + FN}$ (Out of all actual positives, how many did we catch?)
* **F1-Score:** $2 \times \frac{\text{Precision} \times \text{Recall}}{\text{Precision} + \text{Recall}}$

### Q88: When is Precision more important than Recall?
**Example: Spam Email Filter.** A False Positive (important work email sent to Spam) is disastrous. It is better to let one spam email through than hide a critical business contract.

### Q89: When is Recall more important than Precision?
**Example: Cancer Detection or Fraud.** A False Negative (telling a sick patient they are healthy) can cost a life. We must catch 100% of positive cases even if a few healthy patients get an extra checkup.

### Q90: Generate a comprehensive `classification_report`.
```python
from sklearn.metrics import classification_report
print(classification_report(y_test, y_pred))
```

### Q91: What is the ROC-AUC score and how do you calculate it?
**ROC:** Receiver Operating Characteristic curve plotting True Positive Rate vs False Positive Rate.
**AUC:** Area Under the Curve (0.5 = random coin flip, 1.0 = flawless model).
```python
from sklearn.metrics import roc_auc_score
auc = roc_auc_score(y_test, clf.predict_proba(X_test)[:, 1])
```

### Q92: Calculate Regression Metrics: MAE, MSE, RMSE, and $R^2$.
```python
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score
import numpy as np

mae  = mean_absolute_error(y_test, y_pred)
mse  = mean_squared_error(y_test, y_pred)
rmse = np.sqrt(mse)
r2   = r2_score(y_test, y_pred)
```

### Q93: What is K-Fold Cross-Validation and how do you implement it?
**Concept:** Splits data into $K$ equal folds. Trains on $K-1$ folds and tests on the remaining fold. Repeats $K$ times and averages the scores.
```python
from sklearn.model_selection import cross_val_score

scores = cross_val_score(model, X, y, cv=5, scoring='accuracy')
print(f"5-Fold Mean Accuracy: {scores.mean():.4f} (+/- {scores.std():.4f})")
```

### Q94: How do you tune hyperparameters using `GridSearchCV`?
```python
from sklearn.model_selection import GridSearchCV

param_grid = {
    'n_estimators': [50, 100, 200],
    'max_depth': [3, 5, 10]
}
grid = GridSearchCV(RandomForestClassifier(), param_grid, cv=3, scoring='f1')
grid.fit(X_train, y_train)

print("Best Parameters:", grid.best_params_)
print("Best Model:", grid.best_estimator_)
```

### Q95: Why is `RandomizedSearchCV` preferred over `GridSearchCV` for large parameter spaces?
**Answer:** `GridSearchCV` checks every single permutation (computationally slow). `RandomizedSearchCV` samples a fixed number of random combinations, reaching near-optimal parameters in a fraction of the time.

---

# PART 6: Deep Learning & Generative AI Essentials

### Q96: What is an Artificial Neural Network (Multi-Layer Perceptron) and how does forward propagation work?
Each layer computes: $Z = W \cdot X + b$, followed by activation $A = f(Z)$. The signal flows from input layer $\to$ hidden layers $\to$ output layer.

### Q97: What is the Vanishing Gradient problem and how did the ReLU activation function solve it?
In deep networks with Sigmoid/Tanh activations, derivative values are $< 0.25$. As gradients multiply backwards through 10+ layers, they shrink to zero ($\to 0$).
**ReLU Solution:** $f(x) = \max(0, x)$. Its derivative for positive numbers is always $1.0$, allowing gradients to flow backwards without vanishing!

### Q98: Build a simple classification Neural Network using PyTorch.
```python
import torch
import torch.nn as nn

class SimpleMLP(nn.Module):
    def __init__(self, input_dim, hidden_dim, output_dim):
        super(SimpleMLP, self).__init__()
        self.fc1  = nn.Linear(input_dim, hidden_dim)
        self.relu = nn.ReLU()
        self.fc2  = nn.Linear(hidden_dim, output_dim)
        
    def forward(self, x):
        out = self.fc1(x)
        out = self.relu(out)
        out = self.fc2(out)
        return out

model = SimpleMLP(input_dim=10, hidden_dim=32, output_dim=2)
```

### Q99: What are Convolutional Neural Networks (CNN) and why are they better for images than regular MLPs?
1. **Spatial Invariance:** Convolutions detect features (edges, corners) anywhere in an image.
2. **Weight Sharing:** A single $3 \times 3$ filter slides across the entire image, drastically reducing the number of parameters compared to fully connected layers.

### Q100: What is the purpose of Max Pooling in CNNs?
Reduces the spatial dimensions (height and width) of feature maps, lowering computational cost and making feature detection invariant to slight shifts or distortions.

### Q101: What are Recurrent Neural Networks (RNNs) and why were LSTMs invented?
Standard RNNs suffer from vanishing gradients across long time steps. **LSTM (Long Short-Term Memory)** introduced an internal **Cell State** and **3 Gates (Forget, Input, Output)** to remember or forget information across hundreds of time steps.

### Q102: What is the Self-Attention mechanism in Transformers?
It calculates an attention score matrix using Query ($Q$), Key ($K$), and Value ($V$):
$$\text{Attention}(Q, K, V) = \text{softmax}\left(\frac{QK^T}{\sqrt{d_k}}\right) V$$
This allows every word in a sequence to dynamically weigh and attend to every other word regardless of distance.

### Q103: What is Word Embedding and how do you calculate Cosine Similarity between vectors?
Cosine similarity measures the angle between two semantic vectors:
$$\text{Cosine Similarity} = \frac{\vec{A} \cdot \vec{B}}{\|\vec{A}\| \|\vec{B}\|}$$
```python
import numpy as np

def cosine_similarity(v1, v2):
    return np.dot(v1, v2) / (np.linalg.norm(v1) * np.linalg.norm(v2))
```

### Q104: What is Retrieval-Augmented Generation (RAG) and what are its 4 steps?
1. **Chunking & Embedding:** Split company documents into text paragraphs and generate vector embeddings.
2. **Indexing:** Store vectors in a vector database (e.g. Chroma, FAISS).
3. **Retrieval:** Search top $K$ relevant chunks matching the user's question using vector similarity.
4. **Generation:** Pass the retrieved chunks into the LLM system prompt as factual context to produce an accurate answer.

### Q105: What is an AI Agent and how does Tool Calling work?
An AI Agent uses an LLM as its reasoning brain combined with:
- **Planning:** Breaking goals into sub-tasks.
- **Memory:** Retaining conversation history and knowledge.
- **Tools / Functions:** The model outputs structured JSON arguments to call external APIs (web search, databases, Python calculators) and uses the return output to complete real-world tasks.
