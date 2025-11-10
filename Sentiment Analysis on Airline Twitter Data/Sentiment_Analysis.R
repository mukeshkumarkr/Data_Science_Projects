# Installing required libraries
if (!requireNamespace("tm", quietly = TRUE)) install.packages("tm")
if (!requireNamespace("caret", quietly = TRUE)) install.packages("caret")
if (!requireNamespace("nnet", quietly = TRUE)) install.packages("nnet")
if (!requireNamespace("data.table", quietly = TRUE)) install.packages("data.table")
if (!requireNamespace("e1071", quietly = TRUE)) install.packages("e1071")
if (!requireNamespace("randomForest", quietly = TRUE)) install.packages("randomForest")
if (!requireNamespace("dplyr", quietly = TRUE)) install.packages("dplyr")
if (!requireNamespace("readr", quietly = TRUE)) install.packages("readr")
if (!requireNamespace("ggplot2", quietly = TRUE)) install.packages("ggplot2")
if (!requireNamespace("lubridate", quietly = TRUE)) install.packages("lubridate")

# Loading required libraries
library(caret)
library(tm)
library(nnet)
library(data.table)
library(e1071)
library(randomForest)
library(dplyr)
library(readr)
library(ggplot2)
library(lubridate)

# Load the data
tweets <- fread("/Users/tysonmukesh/Downloads/archive/Tweets.csv", encoding = "Latin-1")

# DESCRIPTIVE ANALYSIS

# Count of unique airlines
airline_count <- tweets %>%
  distinct(airline) %>%
  nrow()

# Count of each sentiment type
sentiment_count <- tweets %>%
  group_by(airline_sentiment) %>%
  summarise(count = n())

# Frequency of negative reasons
negative_reason_count <- tweets %>%
  filter(airline_sentiment == "negative") %>%
  group_by(negativereason) %>%
  summarise(count = n()) %>%
  arrange(desc(count))

# Sentiments per airline
sentiment_per_airline <- tweets %>%
  group_by(airline, airline_sentiment) %>%
  summarise(count = n(), .groups = 'drop') %>%
  arrange(airline, desc(count))

# Plotting the sentiment count
ggplot(sentiment_count, aes(x = airline_sentiment, y = count, fill = airline_sentiment)) +
  geom_bar(stat = "identity") +
  geom_text(aes(label = count), vjust = -0.5) +
  theme_minimal() +
  labs(title = "Count of Each Sentiment Type", x = "Sentiment", y = "Count")

# Plotting the negative reasons
ggplot(negative_reason_count, aes(x = reorder(negativereason, count), y = count, fill = negativereason)) +
  geom_bar(stat = "identity") +
  coord_flip() +
  geom_text(aes(label = count), hjust = -0.1) +
  theme_minimal() +
  labs(title = "Frequency of Negative Reasons", x = "Reason", y = "Count")

# Plotting sentiments per airline
ggplot(sentiment_per_airline, aes(x = airline, y = count, fill = airline_sentiment)) +
  geom_bar(stat = "identity", position = position_dodge()) +
  geom_text(aes(label = count), position = position_dodge(width = 0.9), vjust = -0.5) +
  theme_minimal() +
  labs(title = "Sentiment Count per Airline", x = "Airline", y = "Count")

# Display the results
print(paste("Number of unique airlines:", airline_count))

tweetsDA <- mutate(tweets, tweet_time = with_tz(ymd_hms(tweet_created), tzone = "UTC"))

# Extract hour from tweet_created and calculate counts
tweets_by_hour <- tweetsDA %>%
  mutate(hour = hour(tweet_time)) %>%
  count(hour) %>%
  arrange(hour)

# Find the maximum and minimum tweet volumes
max_volume <- which.max(tweets_by_hour$n)
min_volume <- which.min(tweets_by_hour$n)

# Adding a new variable for color that will be used in the plot
tweets_by_hour <- tweets_by_hour %>%
  mutate(volume_type = case_when(
    hour == hour[max_volume] ~ "Maximum Volume",
    hour == hour[min_volume] ~ "Minimum Volume",
    TRUE ~ "Other"
  ))

# Convert the volume type to a factor for a meaningful legend
tweets_by_hour$volume_type <- factor(tweets_by_hour$volume_type, levels = c("Other", "Maximum Volume", "Minimum Volume"))

# Create a custom label color vector
label_colors <- rep("black", 25) # default color for all labels
label_colors[tweets_by_hour$hour[max_volume] + 1] <- "red" # adding 1 because indexing in R starts from 1
label_colors[tweets_by_hour$hour[min_volume] + 1] <- "red"

# Plotting
ggplot(tweets_by_hour, aes(x = hour, y = n)) +
  geom_line(group = 1, color = "blue") +
  geom_point(aes(color = volume_type), size = 3) +
  geom_text(data = subset(tweets_by_hour, volume_type != "Other"), aes(label = n), vjust = -1) +
  scale_x_continuous(breaks = 0:24) +
  scale_color_manual(values = c("Other" = "black", "Maximum Volume" = "purple", "Minimum Volume" = "red")) +
  labs(title = "Tweet Volume by Hour of the Day", x = "Hour of Day", y = "Tweet Count") +
  theme_minimal(base_size = 14) +
  theme(
    panel.background = element_rect(fill = "lightblue", colour = "lightblue"), # change background color
    axis.text.x = element_text(angle = 90, hjust = 1, color = label_colors),
    legend.title = element_blank()
  )

# Preprocess the data: text transformation
corpus <- VCorpus(VectorSource(tweets$text))
corpus <- tm_map(corpus, content_transformer(tolower))
corpus <- tm_map(corpus, removePunctuation)
corpus <- tm_map(corpus, removeNumbers)
corpus <- tm_map(corpus, removeWords, stopwords("english"))
corpus <- tm_map(corpus, stripWhitespace)

# Create a document-term matrix
dtm <- DocumentTermMatrix(corpus)
dtm <- removeSparseTerms(dtm, 0.99)  # this line is optional and can be adjusted
tweets_dtm <- as.data.frame(as.matrix(dtm))
colnames(tweets_dtm) <- make.names(colnames(tweets_dtm))

# Prepare the data for training
tweets_dtm$airline_sentiment <- tweets$airline_sentiment

# Split data into training and test sets
set.seed(530)

#SPLITTING THE DATA 80:20 RATIO
train_indices <- sample(seq_len(nrow(tweets_dtm)), size = 0.8 * nrow(tweets_dtm))

#SPLITTING THE DATA 50:50 RATIO
#train_indices <- sample(seq_len(nrow(tweets_dtm)), size = 0.5 * nrow(tweets_dtm))

train_data <- tweets_dtm[train_indices, ]
test_data <- tweets_dtm[-train_indices, ]

# Convert airline_sentiment to factor with the desired levels
train_data$airline_sentiment <- factor(train_data$airline_sentiment, levels = c("negative", "neutral", "positive"))
test_data$airline_sentiment <- factor(test_data$airline_sentiment, levels = c("negative", "neutral", "positive"))

# Set up k-fold cross-validation on the training data
folds <- createFolds(train_data$airline_sentiment, k = 5)  
ctrl <- trainControl(method = "cv", index = folds)

######## MODELS ###########


# 1 NAIVE BAYES

## Without K-Fold
model <- naiveBayes(airline_sentiment ~ ., data = train_data)

## With K-Fold
#model <- naiveBayes(airline_sentiment ~ ., data = train_data, trControl = ctrl)



# 2 MULTINOMIAL LOGISTIC REGRESSION

## Without K-Fold
#model <- multinom(airline_sentiment ~ ., data = train_data)

## With K-Fold
#model <- train(airline_sentiment ~ ., data = train_data, method = "multinom", trControl = ctrl)



# 3 RANDOM FORESTS

## Without K-Fold
#model <- randomForest(airline_sentiment ~ ., data = train_data, ntree = 50)

## With K-Fold
#model <- randomForest(airline_sentiment ~ ., data = train_data, trControl = ctrl)




# 4 SUPPORT VECTOR MACHINES

## Without K-Fold
#model <- svm(airline_sentiment ~ ., data = train_data)

## With K-Fold
#model <- svm(airline_sentiment ~ ., data = train_data, trControl = ctrl)



#########################################

# Make predictions
predictions <- predict(model, test_data, type = "class")

#predictions <- predict(model, test_data, type = "raw") # Select for Multinomial K-Fold

predictions <- factor(predictions, levels = c("negative", "neutral", "positive"))

# Evaluate the model
conf_matrix <- confusionMatrix(predictions, test_data$airline_sentiment)
table(pred = predictions, true = test_data$airline_sentiment)

# Print confusion matrix and accuracy
overall_accuracy <- sum(diag(conf_matrix$table)) / sum(conf_matrix$table)
print(paste("Overall accuracy: ", overall_accuracy))

# Get the confusion matrix values
conf_matrix_values <- conf_matrix$table

# Calculate Precision for each class
precision_negative <- conf_matrix_values[1, 1] / sum(conf_matrix_values[1, ])
precision_neutral <- conf_matrix_values[2, 2] / sum(conf_matrix_values[2, ])
precision_positive <- conf_matrix_values[3, 3] / sum(conf_matrix_values[3, ])

# Calculate Recall (Sensitivity) for each class
recall_negative <- conf_matrix_values[1, 1] / sum(conf_matrix_values[, 1])
recall_neutral <- conf_matrix_values[2, 2] / sum(conf_matrix_values[, 2])
recall_positive <- conf_matrix_values[3, 3] / sum(conf_matrix_values[, 3])

# Calculate overall precision
overall_precision <- (precision_negative + precision_neutral + precision_positive) / 3

# Print overall precision
print(paste("Overall Precision: ", overall_precision))

# Calculate overall recall
overall_recall <- (recall_negative + recall_neutral + recall_positive) / 3

# Print overall recall
print(paste("Overall Recall (Sensitivity): ", overall_recall))
