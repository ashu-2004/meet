from groq import Groq
import os
import markdown
from typing import List, Dict
import json

class InterviewAnalyzer:
    def __init__(self):
        self.groq_client = Groq(api_key=os.getenv("GROQ_API_KEY"))
        print("Groq client initialized.", os.getenv("GROQ_API_KEY"))
        self.conversation_history: List[Dict] = []
        
    def analyze_response(self, transcript: str) -> Dict:
        """
        Analyze the candidate's response using Groq and generate follow-up questions.
        """
        self.conversation_history.append({"role": "user", "content": transcript})
        
        system_prompt = """You are an AI-powered technical interview evaluator. 
Your task is to:
1. Analyze the candidate's response to the previous question
2. Evaluate their technical knowledge and communication skills
3. Generate a relevant follow-up question based on their answer
4. Provide an expected answer for the follow-up question
5. Provide feedback in a structured format

Format your response in markdown with the following sections:
## Analysis
- Key points from the answer
- Technical accuracy
- Communication clarity

## Evaluation
- Strengths
- Areas for improvement
- Technical depth

## Next Question
- Provide one clear, concise follow-up question 

## Expected Answer
- Detailed explanation of what a good answer to the next question should include
- Key technical points that should be mentioned
- Common misconceptions to avoid

Keep the tone professional and constructive."""

        try:
            messages = [
                {"role": "system", "content": system_prompt}
            ] + self.conversation_history[-5:] 

            response = self.groq_client.chat.completions.create(
                model="llama-3.1-8b-instant",
                messages=messages,
                temperature=0.7,
                max_tokens=1024
            )

            analysis_result = response.choices[0].message.content.strip()
            
            self.conversation_history.append(
                {"role": "assistant", "content": analysis_result}
            )

            html_output = markdown.markdown(analysis_result)

            sections = self._extract_sections(analysis_result)

            return {
                "transcript": transcript,
                "analysis": analysis_result,
                "analysis_html": html_output,
                "next_question": sections.get("next_question", ""),
                "expected_answer": sections.get("expected_answer", ""),
                "previous_analysis": sections.get("analysis_of_previous_answer", "")
            }

        except Exception as e:
            print(f"Error in Groq analysis: {str(e)}")
            return {
                "error": "Failed to analyze response",
                "transcript": transcript
            }

    def _extract_sections(self, analysis: str) -> Dict[str, str]:
        """
        Extract sections from the analysis text.
        """
        sections = {}
        current_section = None
        current_content = []
        
        for line in analysis.split('\n'):
            if line.startswith('## '):
                if current_section and current_content:
                    sections[current_section.lower().replace(' ', '_')] = '\n'.join(current_content).strip()
                    current_content = []
                
                current_section = line[3:].strip()
            elif current_section:
                current_content.append(line)
        
        if current_section and current_content:
            sections[current_section.lower().replace(' ', '_')] = '\n'.join(current_content).strip()
        
        return sections

    def reset_conversation(self):
        """Reset the conversation history"""
        self.conversation_history = []
        return {"status": "Conversation history reset"}
